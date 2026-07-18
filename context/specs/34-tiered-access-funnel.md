# Unit 34: Tiered Access Funnel (3 anonymous → login → 12 lifetime)

User direction (2026-07-16, decisions confirmed): a three-tier funnel —
**3 reports per anonymous browser (lifetime)** → Google-OAuth login wall →
**12 reports per account (lifetime, claimed anonymous history included)** →
the detailed-report concierge tier (Unit 35: Telegram + X handle lead,
curated manually, delivered within a day). Today's report content stays as-is
for all tiers; "detailed" adds the analyst's curated layer, not a different
render. The existing daily abuse caps (Unit 26) remain in force on top.

## Design

- Shared (`limits.ts`): `TierLimits { anonLifetime: 3, userLifetime: 10 }`
  (was 12; lowered 2026-07-18)
  with env overrides `FREE_TIER_ANON_LIFETIME` / `FREE_TIER_USER_LIFETIME`
  (positive ints; invalid → default), plus a pure `decideTier(count,
  isAuthenticated, limits)` returning `allowed | login_required |
  upgrade_required` (regression-testable without a DB).
- Shared (`api.ts`): `ApiErrorCode` += `login_required`, `upgrade_required`
  (additive).
- Web `lib/tier-gate.ts`: counts the owner's LIFETIME `AnalysisRequest` rows
  (anonymous = cookie ownerId; signed-in = user id — the Unit 28 claim
  already merges anonymous history into the account, so the 3 free ones
  count toward the 12) and applies `decideTier`.
- `POST /api/analyses`: tier gate runs BEFORE the daily rate limit (the
  funnel message beats the generic one): `login_required` → 401,
  `upgrade_required` → 403, friendly copy in `message`.
- Form (`analysis-form.tsx`): code-aware error panel — `login_required`
  renders a sign-in CTA (link to `/login`); `upgrade_required` renders the
  concierge pitch (the request CTA itself lands with Unit 35).

Anonymous counting is cookie-based and resettable via incognito — accepted
v1 leak (confirmed). Admin/manual quota raises deferred (user picked plain
lifetime counts).

## Verification

`pnpm build`; regression check `tier-gates.regression.cjs` (decideTier
boundaries 2/3 and 11/12, env overrides, invalid overrides, anonymous vs
authenticated paths); manual funnel walk by the user.
