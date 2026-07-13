# Unit 28 — User Authentication (real per-user identity; anonymous + claim)

## Goal

Replace the per-browser `kolfit_owner` cookie as the *sole* notion of ownership
with **real user accounts**, so ownership survives cookie clears / new devices
and becomes the basis for future workspaces/roles. Two product decisions (locked
with the user):

- **Auth approach:** a small **auth seam** (like the Twitter/LLM provider
  abstractions). Default = a **dev email login** (works fully on localhost, no
  Supabase needed) so this is buildable + verifiable now. A **Supabase adapter**
  activates automatically when Supabase env is present — flip to real Supabase
  Auth at deploy with no app-code change.
- **Gating:** **anonymous use stays**; logging in **claims** the current
  anonymous cookie's history to the account. The app is NOT hard-gated behind
  login.

The elegant consequence: **ownership id simply *becomes* the user id when signed
in.** The existing `owner.ts` seam (`getOwnerId`/`ensureOwnerId`) changes what id
it returns; the 6 existing call sites stay unchanged.

## Non-goals (explicitly out of scope)

- Workspaces / multi-tenant / roles (schema already has nullable `workspaceId`;
  this unit is **users only**).
- Password reset, email verification, MFA (Supabase owns these in prod).
- Hard-gating the app behind login.
- Changing the **admin** panel's auth (Unit 27 `ADMIN_PASSWORD` stays as-is).

## Verification boundary (be honest)

- The **dev path** (default) is fully built AND **live-verified** end-to-end
  against a throwaway Postgres (login → session → ownership=userId → claim →
  per-user rate limit → sign out).
- The **Supabase adapter** cannot be run without a live Supabase project, so it
  is built to the current official `@supabase/ssr` pattern, typechecked, kept
  **isolated behind `resolveAuthMode()`**, and clearly marked
  **"activate + verify at deploy."** It must not affect the dev/default path.

## 1. New package `packages/auth` (`@kol-fit/auth`) — pure, framework-agnostic

No Next, Prisma, Supabase, or zod deps — only `node:crypto`. This is the
dist-testable security core (mirrors how `resolveAbuseLimits` lives in shared).

- `types.ts`: `export type AuthUser = { id: string; email: string | null };`
  `export type AuthMode = "dev" | "supabase";`
- `session.ts` — stateless signed dev-session token:
  - `signSessionToken(userId: string, secret: string): string`
    → `${userId}.${base64url(hmacSHA256(userId, secret))}`.
  - `verifySessionToken(token: string, secret: string): string | null`
    → returns `userId` iff the HMAC matches (constant-time compare via
    `crypto.timingSafeEqual`); null on any tamper/format/secret mismatch. Never
    throws.
- `mode.ts` — `resolveAuthMode(env): AuthMode` → `"supabase"` iff both
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are non-empty;
  else `"dev"`. Also `devLoginAllowed(env): boolean` → true unless
  `NODE_ENV === "production"` and `AUTH_DEV_LOGIN !== "true"` (fail-closed: no
  passwordless login in prod unless explicitly opted in).
- `index.ts` barrel. tsconfig `types:["node"]`, package.json like other leaf
  packages (`build: tsc -p tsconfig.json`).

## 2. Prisma: new `User` model (additive; no FK on ownerId)

```prisma
model User {
  id        String   @id @default(cuid())   // dev: cuid; supabase: the auth UUID
  email     String   @unique
  createdAt DateTime @default(now())
  lastLoginAt DateTime?
}
```
`AnalysisRequest.ownerId` stays a **nullable free string** (it holds *either* an
anonymous cookie id *or* a `User.id`) — do NOT add a foreign key (existing
cookie-owned rows would violate it). No other model changes. This is a schema
change → `prisma db push` (document it; run against the throwaway DB in
verification, and note the user must push to their own DB).

## 3. Web auth glue `apps/web/lib/auth/`

- `session.ts` (dev): cookie name `kolfit_session`, httpOnly, sameSite lax,
  `secure` in prod, path `/`, maxAge 30d. Uses `@kol-fit/auth` sign/verify with
  `process.env.AUTH_SESSION_SECRET`. `readDevUserId()` (verify cookie → userId|null),
  `setDevSession(userId)`, `clearDevSession()`. If `AUTH_SESSION_SECRET` is
  unset, dev sessions are disabled (treat as logged-out — safe fallback).
- `supabase.ts` (supabase mode only): `createServerSupabase()` using
  `createServerClient(URL, ANON_KEY, { cookies: { getAll, setAll } })` per the
  current `@supabase/ssr` App-Router guide. **Read the official guide with
  WebFetch before writing this file** (https://supabase.com/docs/guides/auth/server-side/nextjs)
  — do not guess the getAll/setAll signatures. Read the user via **`getClaims()`
  (or `getUser()`) — never `getSession()`** server-side.
- `current-user.ts` — the seam the rest of the app uses:
  - `getCurrentUserId(): Promise<string | null>` → supabase mode: the Supabase
    user id; dev mode: `readDevUserId()`.
  - `getCurrentUser(): Promise<AuthUser | null>` → resolves id + email (dev: load
    `User` by id; supabase: from claims + mirror-upsert). Used by nav only.
- `index.ts` barrel.

## 4. Rework `apps/web/lib/owner.ts` (minimal, keep the function names)

- `getOwnerId()` → `(await getCurrentUserId()) ?? <kolfit_owner cookie value ?? null>`.
- `ensureOwnerId()` → if signed in, return the user id (no cookie needed);
  else ensure + return the `kolfit_owner` anonymous cookie (today's behavior).
- Keep the anonymous cookie logic intact for the logged-out path. All 6 existing
  call sites (`route.ts`, `[id]/route.ts`, `deliver/route.ts`, `analyses/page.tsx`)
  keep working unchanged — per-user scoping + per-user rate limiting now follow
  automatically because `ownerId` is the user id when signed in.

## 5. Auth routes + claim-on-login

- `POST /api/auth/session` (dev login): body `{ email }` (validate: non-empty,
  contains `@`; lowercase/trim). Guard with `devLoginAllowed(process.env)` +
  `resolveAuthMode==="dev"` (else 404/400). Upsert `User` by email (set
  `lastLoginAt`), `setDevSession(user.id)`, then **claim** (see below), return
  `ok({ id, email })`.
- `DELETE /api/auth/session` (sign out): `clearDevSession()` (+ supabase signOut
  in supabase mode), return ok.
- `GET/POST /auth/callback` (supabase mode only): exchange the code
  (`exchangeCodeForSession`), mirror-upsert the `User` (id = supabase uuid,
  email), **claim**, redirect home. Isolated; unused in dev mode.
- **Claim helper** `apps/web/lib/auth/claim.ts`:
  `claimAnonymousReports(userId)` → read the current `kolfit_owner` cookie value;
  if present and `!== userId`, `prisma.analysisRequest.updateMany({ where:{ ownerId: cookieId }, data:{ ownerId: userId } })`.
  Best-effort (never throw out of login); log the count only (no PII).

## 6. Middleware (supabase session refresh only)

`apps/web/middleware.ts`: in **supabase mode**, refresh the session per the
official middleware pattern (getClaims + cookie passthrough) and matcher
excluding static assets. In **dev mode**, it must be a **no-op** (return
`NextResponse.next()`), so localhost is unaffected. Keep it tiny.

## 7. UI

- `apps/web/components/auth/user-menu.tsx` (client): shows the signed-in email +
  a "Sign out" action (DELETE the session, refresh), or a "Sign in" link to
  `/login` when logged out. Slot into `top-nav.tsx`.
- `apps/web/app/login/page.tsx` + `components/auth/login-form.tsx`: dev mode → an
  email field posting to `/api/auth/session`; supabase mode → a magic-link/OAuth
  entry (kept minimal; the real flow is verified at deploy). Branch on a
  server-provided `mode`. After dev login success → `router.push("/analyses")`.

## 8. Env + `.env.example`

```
# User auth (Unit 28). Dev email login by default (localhost). Set the two
# NEXT_PUBLIC_SUPABASE_* vars to switch to real Supabase Auth (deploy).
AUTH_SESSION_SECRET=            # required for dev login; a long random string
# AUTH_DEV_LOGIN=true           # allow passwordless dev login in production (unsafe; off by default)
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## 9. Deps

`apps/web` += `@supabase/ssr` + `@supabase/supabase-js` (used only by the
supabase adapter/middleware; dev path never imports them at runtime — keep them
out of the dev code path so a missing install can't break dev) and
`@kol-fit/auth` (workspace). No deps added to `packages/auth`.

## 10. Regression check `scripts/checks/auth.regression.cjs`

Offline, requires `packages/auth/dist/index.js`. Wire into `pnpm check` +
`check:auth` alias. Assertions:
- `signSessionToken` then `verifySessionToken` round-trips → the same userId.
- tampered token / wrong secret / malformed (no dot, empty, extra segments) →
  null (never throws).
- constant-time path: a token with a valid-length-but-wrong signature → null.
- `resolveAuthMode`: both supabase vars set → "supabase"; either missing → "dev".
- `devLoginAllowed`: prod + no flag → false; prod + `AUTH_DEV_LOGIN=true` → true;
  non-prod → true.
Print `AUTH REGRESSION: N passed, M failed`; exit nonzero on failure.

## 11. Docs

- `context/architecture.md`: replace/extend the "Auth and Access Model" section
  to document the seam (dev default + Supabase adapter), the anonymous+claim
  model, ownership-id-becomes-user-id, and that admin (Unit 27) is a separate
  operator gate. Note the Supabase adapter is deploy-activated + not yet
  live-verified.
- `context/progress-tracker.md`: Unit 28 Completed entry (absolute date
  2026-07-13), update Current Phase/Goal.

## Invariants preserved

- Secrets only from env; never logged/returned (`AUTH_SESSION_SECRET`, Supabase
  keys). Session token is an HMAC, compared in constant time.
- API routes stay thin; no analysis work added. Ownership/rate-limit behavior is
  unchanged except that the id is now a user id when signed in.
- No FK migration risk (ownerId stays a free string). Additive `User` model only.
- Dev passwordless login is fail-closed in production.

## Acceptance

- `pnpm build` green (all projects incl. new `packages/auth`).
- `pnpm check` green incl. the new suite.
- Live dev E2E (throwaway PG): (1) anonymous create → report owned by cookie id;
  (2) dev login with an email → session set, User row created, the anonymous
  report's `ownerId` re-assigned to the user id (claim); (3) a new analysis while
  signed in → `ownerId` = user id; (4) the reports list + `/api/analyses/[id]`
  show the claimed + new reports for the user; (5) per-owner rate limit now keyed
  on the user id (clearing the anon cookie no longer resets it once signed in);
  (6) sign out → `getOwnerId` falls back to the anon cookie.
- Supabase adapter: builds/typechecks, isolated, marked unverified.
