# Unit 27: Admin Panel

## Goal

Give the operator a single, password-protected place to see **what is happening
in the system**: who is using it, what they analyzed, who left an email/Telegram
handle, what it failed on, and what it cost.

Everything the panel shows already exists in Postgres (`AnalysisRequest`,
`AnalysisJob`, `Report`, `ReportDelivery`, `ProviderUsageLog`). This unit adds
**no new data collection** — it is a read-only view over saved state, plus a
minimal admin session.

Deliberately simple: four pages, plain tables, no charts, no destructive
actions.

## Scope

### In scope

- `/admin` — overview KPIs (usage, jobs, leads, spend, limit headroom).
- `/admin/analyses` — every analysis across **all** owners (not owner-scoped),
  with status, verdict, score, attempts, error code, owner id, and search.
- `/admin/leads` — every `ReportDelivery` row: **who gave an email / Telegram
  handle**, for which report, and its per-channel delivery status.
- `/admin/usage` — provider spend/tokens/requests, per provider and recent rows.
- `/admin/login` — password form.
- Admin session: one shared password from `ADMIN_PASSWORD`; a signed httpOnly
  cookie; fail-closed when the env var is unset.
- Admins may open any report (the owner-scoped 404 in
  `GET /api/analyses/[id]` is relaxed for a valid admin session only).

### Out of scope

- Real user accounts/roles (still the future auth unit). One shared password.
- Any mutation: no deleting reports, re-running jobs, editing limits, or
  exporting leads. Read-only.
- Charts/graphs, real-time streaming, alerting, per-day time series.
- Changing what is stored or how analyses run.

## Auth model

- `ADMIN_PASSWORD` (env). **Unset or empty ⇒ the admin panel is disabled**: the
  pages render a "not configured" notice and `POST /api/admin/session` returns
  404. It is never open by default.
- `POST /api/admin/session` with the password sets `kolfit_admin`, an httpOnly,
  sameSite=lax, `secure` in production cookie holding
  `sha256("kolfit-admin-v1:" + ADMIN_PASSWORD)`. `DELETE` clears it.
- Every admin page and admin API route calls `requireAdmin()`, which recomputes
  the expected token and compares with `timingSafeEqual`. Rotating
  `ADMIN_PASSWORD` invalidates existing sessions.
- The password is only ever read from env, compared in constant time, and never
  logged or returned. This is a shared-secret gate for an internal tool, not a
  user identity system.

## Data shown

| Page | Source | Fields |
| --- | --- | --- |
| Overview | `AnalysisRequest`, `AnalysisJob`, `Report`, `ReportDelivery`, `ProviderUsageLog` | analyses (24h / 7d / all), job status counts, unique owners (browsers), leads + distinct emails/Telegram handles, spend + tokens (24h / all), global daily-cap headroom, verdict mix, top KOLs, top orgs, recent activity |
| Analyses | `AnalysisRequest` + `job` + `report` | created, org, KOL, owner id (truncated), job status, attempts, error code, verdict, score, link to the report |
| Leads | `ReportDelivery` + `report.request` | created, email, Telegram handle, per-channel status, error code, the org/KOL pair it was for |
| Usage | `ProviderUsageLog` | totals by provider (requests, tokens in/out, cost), recent rows with operation + request link |

Pagination: cursor-based (`?cursor=`), same idiom as the existing reports list.

## Files

- `apps/web/lib/admin/auth.ts` — session/token helpers (`isAdminConfigured`,
  `verifyAdminPassword`, `isAdminRequest`, `requireAdmin`, cookie set/clear).
- `apps/web/lib/admin/types.ts` — the DTOs the queries return and the UI renders.
- `apps/web/lib/admin/queries.ts` — all Prisma reads/aggregations.
- `apps/web/app/api/admin/session/route.ts` — login/logout.
- `apps/web/app/admin/{page,analyses/page,leads/page,usage/page,login/page}.tsx`.
- `apps/web/components/admin/*` — nav, stat cards, tables, login form.
- `apps/web/app/api/analyses/[id]/route.ts` — one line: allow a valid admin
  session past the owner check.

## Verification

- `ADMIN_PASSWORD` unset ⇒ `/admin` shows "not configured"; login route 404s.
- Wrong password ⇒ no cookie, generic error. Correct password ⇒ redirected to
  `/admin`, all four pages render live DB numbers.
- Without the cookie, every `/admin` page redirects to `/admin/login`.
- Analyses/leads/usage show rows created by **other** browsers (not owner-scoped).
- Admin can open a report created by another browser; a non-admin still 404s.
- `pnpm build` + `pnpm check` green.
