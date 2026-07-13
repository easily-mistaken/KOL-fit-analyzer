# Architecture Context

## Architecture Summary

Crypto KOL Fit Analyzer should be built as a serious but lean modular system. It should support deep analysis, background jobs, saved reports, provider abstraction, and future agency workflows without requiring expensive enterprise infrastructure at the start.

The architecture is a TypeScript modular monolith with a separate worker process:

- Next.js web app for UI and lightweight API routes
- Node.js worker for long-running analysis jobs
- Supabase Postgres as the primary database
- Prisma as ORM
- pg-boss for Postgres-backed background jobs
- TwitterAPI.io as the first Twitter/X data provider
- OpenAI as the first LLM provider, behind an abstraction

Do not run deep analysis inside Next.js request/response handlers. API routes create jobs. Workers execute jobs.

## Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Package manager | pnpm + pnpm workspaces | Monorepo dependency management and workspace-aware scripts |
| Web framework | Next.js + TypeScript | Dashboard, forms, report pages, API route handlers |
| UI | Tailwind CSS + shadcn/ui | Consistent SaaS-style interface and reusable components |
| Database | Supabase Postgres | Primary relational storage for requests, jobs, reports, profiles, evidence, and analysis outputs |
| ORM | Prisma | Typed database schema, migrations, and main CRUD access |
| Background jobs | pg-boss | Postgres-backed job queue for analysis jobs without requiring Redis at the start |
| Worker runtime | Node.js + TypeScript | Executes long-running analysis jobs outside HTTP request lifecycle |
| X/Twitter data | TwitterAPI.io | First provider for profiles, tweets, replies, quotes, retweeters, followers where available |
| X/Twitter provider abstraction | Custom package | Allows switching to Official X API, Bright Data, Apify, or other providers later |
| LLM | OpenAI first | Classification, reasoning, and final report generation |
| LLM provider abstraction | Custom package | Allows switching or comparing OpenAI, Claude, Gemini, or other models later |
| Validation | Zod | Runtime validation for API inputs, provider responses, LLM outputs, and internal schemas |
| Deployment | Vercel + Railway/Render/Fly + Supabase | Web on Vercel, worker on a long-running Node host, database on Supabase |
| Storage later | Supabase Storage or S3-compatible storage | Optional storage for raw large API payloads and generated exports |
| Vector search later | pgvector | Optional semantic memory for KOL intelligence and historical matching |

## Repository Structure

Use a monorepo-style structure even if all code lives in one repository.

```txt
apps/
  web/                 # Next.js app, pages, API routes, report UI
  worker/              # Node.js worker process for pg-boss jobs

packages/
  db/                  # Prisma schema, Prisma client, database helpers
  queue/               # pg-boss setup, enqueue helpers, job-name constants, job-payload schemas
  twitter/             # Twitter/X provider interface and TwitterAPI.io implementation
  llm/                 # LLM provider interface and OpenAI implementation
  analysis/            # Analysis pipeline orchestration
  scoring/             # Deterministic scoring logic and score weights
  shared/              # Shared types, constants, Zod schemas, enums

context/
  specs/               # Build plan and unit specs
```

If a simpler single-app setup is used initially, the same boundaries must still be preserved through folders/modules.

The repository is a pnpm workspace (`pnpm-workspace.yaml` at the root covering `apps/*` and `packages/*`). Git is initialized as part of Unit 01 with a standard `.gitignore`; no commits are made unless explicitly requested.

## System Boundaries

- `apps/web/` — Owns user-facing UI, forms, report pages, polling/status display, and route handlers. Must not own scoring logic, provider logic, or long-running analysis logic.
- `apps/web/app/api/` — Owns lightweight request handlers. API routes validate input, enforce auth when added, create jobs, fetch report status, and return report data. They must not execute full analysis jobs.
- `apps/worker/` — Owns the long-running worker process. It starts pg-boss, registers job handlers, executes analysis jobs, updates job/report status, and handles retries/errors.
- `packages/db/` — Owns Prisma schema, migrations, Prisma client, database models, and database access helpers.
- `packages/queue/` — Owns the pg-boss queue boundary: queue setup/lifecycle, enqueue helpers, job-name constants, and job-payload schemas. Isolates pg-boss so a future BullMQ swap is package-internal. Used by `apps/web` (enqueue) and `apps/worker` (consume). Uses the direct (non-pooled) database connection.
- `packages/twitter/` — Owns Twitter/X data provider interfaces and implementations. No UI, scoring, or report generation logic belongs here.
- `packages/llm/` — Owns LLM provider interfaces, model call helpers, structured-output validation, and provider-specific adapters.
- `packages/analysis/` — Owns the orchestration pipeline that combines org analysis, KOL analysis, audience analysis, scoring, and final report generation.
- `packages/scoring/` — Owns deterministic scoring functions, weights, risk calculations, audience-overlap calculations, and scoring tests.
- `packages/shared/` — Owns shared Zod schemas, TypeScript types, enums, constants, and normalized response shapes.
- `context/` — Owns product, architecture, UI, code standards, workflow, progress, and spec documentation. Context files must be kept in sync with implementation decisions.

## Data Flow

```txt
User submits analysis form
↓
Next.js API validates input
↓
API creates AnalysisRequest + AnalysisJob in Postgres
↓
API enqueues pg-boss job
↓
Worker picks job
↓
Worker fetches org/KOL/audience data through provider interfaces
↓
Worker stores normalized snapshots/evidence summaries
↓
Analysis pipeline classifies and scores
↓
LLM generates structured reasoning and report
↓
Worker validates report JSON and saves final report
↓
Frontend polls status and renders report
```

## Storage Model

### Database: Supabase Postgres

Store structured product data:

- users/workspaces later
- analysis requests
- analysis jobs
- organization snapshots
- KOL snapshots
- fetched tweet metadata summaries
- engaged account samples
- audience classification summaries
- score breakdowns
- final report JSON
- report status and error metadata
- provider usage/cost metadata where possible

### Object Storage: Supabase Storage/S3 later

Use only when raw payloads become too large for the database or when exports are added.

Possible future storage:

- raw API payload JSON files
- exported reports
- generated PDFs
- large evidence bundles

### Cache

Do not add Redis initially.

Use database-backed caching first:

- cache fetched profiles by handle
- cache recent tweet snapshots with timestamps
- cache report results

Add Redis/BullMQ only when Postgres-backed jobs become a bottleneck.

**Implemented (Unit 19):** Twitter/X provider reads are cached in the
`ProviderCache` table (a generic key/value store: `key`, `provider`, `payload`
JSON, `fetchedAt`, `expiresAt`). Caching lives worker-side in `@kol-fit/cache`
as a `withTwitterCache(provider, store, config)` decorator so the pipeline
(`@kol-fit/analysis`) stays pure and db-free. Cache keys are versioned per
operation (`tw:v1:profile:<handle>`, `tw:v1:tweets:<handle>:<limit>`,
`tw:v1:replies|tweetReplies|tweetQuotes|retweeters|followers:...`); the stored
value is the normalized shared-type output, never raw payloads (Invariant 15).
The decorator is **miss-safe**: any store error is treated as a miss/no-op and
never fails an analysis. TTLs: profiles 24h (`CACHE_TTL_PROFILE_SECONDS`),
tweets/engagement 6h (`CACHE_TTL_SECONDS` / `CACHE_TTL_TWEETS_SECONDS`).
`CACHE_ENABLED=false` disables caching (full pass-through). Expired rows are
deleted lazily on read miss. `searchTweets` is not cached.

**Implemented (Unit 23) — cross-analysis classification reuse:** the expensive
LLM classifications are also cached in `ProviderCache` (`provider: "llm"`) via a
`withLlmCache(provider, store, config)` decorator, so re-analyses reuse them
(`A×B` then `D×B` reuses the KOL's audience + content classification; `A×B` then
`A×C` reuses the org classification). Keys are **content-addressed** — a
sha-256 of the call's actual inputs + model under a versioned `cls:v1:`
namespace (`content`: handle + sorted post/reply ids; `audience`: sorted
engaged-account ids+sources + `OPENAI_AUDIENCE_CLASSIFICATION_LIMIT`; `org`:
handle + brief + website hash) — so a cached result is served **only** for
identical inputs (no staleness/mismatch risk, no cross-pair leakage). Cached
payloads are re-validated against their Zod schema on read (miss on drift), the
decorator is miss-safe, and **`generateFitReport` is pair-specific and never
cached**. TTL defaults to 14 days (`CLASSIFICATION_CACHE_TTL_SECONDS`, per-kind
overridable; `CLASSIFICATION_CACHE_ENABLED=false` disables). Classification
cache hits/misses are recorded in the LLM `ProviderUsageLog.meta`. Caching lives
worker-side (`packages/cache` + `buildProviders`); the pipeline and providers
stay `@kol-fit/db`-free.

## Suggested Database Models

Initial models should include at least:

```txt
AnalysisRequest
AnalysisJob
OrgSnapshot
KolSnapshot
EngagedAudienceSample
AudienceClassificationSummary
ScoreBreakdown
AnalysisReport
ProviderUsageLog
```

Optional later:

```txt
User
Workspace
WorkspaceMember
KolProfileMemory
OrgProfileMemory
ReportExport
```

## Auth and Access Model

### Initial Internal Version

Auth is out of scope for the first build. Do not install Clerk, Supabase Auth, or any auth library yet.

Assume a single internal workspace for now — there is no login, no multi-tenant isolation.

**Anonymous per-browser ownership (Unit 25):** as a pre-auth stand-in for "see only your own reports," each `AnalysisRequest` carries a nullable `ownerId` set from a private `kolfit_owner` cookie (a random id created on first submit, `apps/web/lib/owner.ts`). The reports list and each report/deliver route are scoped to the cookie's owner; a non-owner (or no cookie) gets an empty list / a 404 (404 not 403, so existence isn't leaked). Limits (honest, pre-auth): per-browser/device only — clearing cookies or switching devices loses visibility, and pre-Unit-25 reports (null `ownerId`) are not shown. Real cross-device ownership is the future auth unit; `ownerId` maps cleanly onto a real user id then. The **caches (`ProviderCache`) are deliberately NOT owner-scoped** — they key on handle/inputs and are shared across everyone (public-account classifications; no user-private data), so cost savings are shared while report *visibility* is scoped.

Even though auth is skipped initially, the database schema must not block adding users/workspaces later:

- `AnalysisRequest` and `AnalysisReport` should carry a nullable `workspaceId` (or equivalent) field from the first schema onward, even though it is unused/always-null in the first build.
- No query logic should assume a hardcoded single-tenant shortcut that would need to be rewritten; it should simply filter by `workspaceId IS NULL` or a default workspace row until real workspaces exist.

### Future SaaS/Agency Version

When auth is added:

- Every user signs in through Clerk or Supabase Auth.
- Reports belong to a user or workspace.
- Users can only read reports they own or reports in workspaces they belong to.
- Mutations must enforce auth and ownership before writing data.
- Public share links, if added, must use explicit share tokens and read-only access.

## Background Job Model

Use pg-boss for background work.

Job types:

- `analysis.run` — executes one org-vs-KOL analysis
- future: `analysis.retry`
- future: `report.export`
- future: `provider.refresh-profile`

Worker responsibilities:

1. Load pending jobs.
2. Mark job status as running.
3. Fetch all required data through provider interfaces.
4. Store normalized evidence and snapshots.
5. Run deterministic scoring.
6. Call LLM for classification/report generation.
7. Validate LLM output.
8. Save final report.
9. Mark job complete or failed.
10. Store error details without leaking secrets.

### Error Handling & Failure Taxonomy (Unit 21)

Failures are made understandable and safe without leaking internals:

- The worker maps any thrown pipeline/provider error to a **stable, user-facing `AnalysisErrorCode`** via `classifyAnalysisError` (`apps/worker/src/errors.ts`): `TwitterApiError`/`OpenAiError` are mapped by their `.code` to slugs like `twitter_not_found`, `twitter_rate_limited`, `llm_invalid_output`, `llm_auth`, …; anything unrecognized → `analysis_failed`.
- Each code has a **fixed, safe, human-friendly message**. Only these codes/messages are persisted (`AnalysisJob.errorCode`/`errorMessage`) and shown in the UI — raw provider/exception text, keys, URLs, and PII never reach the DB, logs, or client. Worker failure logs emit only the code + a bounded message string.
- **Retry metadata:** `AnalysisJob.attempts` is incremented on each QUEUED→RUNNING transition. Per-job errors stay isolated (a failure marks that job FAILED and is ack'd, so one bad job can't sink the pg-boss batch) and processing is idempotent (a COMPLETED job short-circuits). Automatic retry/backoff is **not** enabled yet (the handler does not re-throw to pg-boss) — deferred to a future `analysis.retry`.
- The failed report page renders the friendly message + code + attempt count + `failedAt`, and offers "start a new analysis" / "back to reports" (no re-enqueue endpoint yet).

### Abuse & Cost Controls (Unit 26)

`POST /api/analyses` is public and unauthenticated, yet each run fans out to real
paid TwitterAPI.io + OpenAI spend. Two DB-backed caps bound worst-case
denial-of-wallet exposure without new infrastructure (no Redis; matches the
"database-backed first" principle):

- **Per-owner cap** and **global (spend-ceiling) cap** — before creating an
  analysis, `checkAnalysisRateLimit(ownerId)` (`apps/web/lib/rate-limit.ts`)
  counts `AnalysisRequest`s over a rolling 24h window: per `ownerId` cookie
  (default 10 = `MAX_ANALYSES_PER_OWNER_PER_DAY`) and across all owners (default
  200 = `MAX_ANALYSES_PER_DAY`). At/over either cap the route returns **HTTP 429**
  `rate_limited` with a safe message; the check is two `count()` reads (not
  analysis work), kept inside the route `try` so DB errors fall to the generic
  500 path. Limits resolve from env via `resolveAbuseLimits` (`packages/shared`).
- **Optional spend cap** — when `MAX_DAILY_SPEND_USD > 0` (default 0 = disabled),
  the check also sums `ProviderUsageLog.costUsd` over the same window and refuses
  once it reaches the budget.
- **Transient-failure retry** — the worker now retries transient provider
  failures (rate-limit/timeout/outage: `RETRYABLE_CODES` in
  `apps/worker/src/errors.ts`; auth/config/not_found/invalid_output/analysis_failed
  are terminal). On a retryable failure with attempts left
  (`ANALYSIS_MAX_ATTEMPTS`, default 3), the handler sets the job back to QUEUED and
  re-enqueues via a **delayed** `analysis.run` (`enqueueAnalysisRun(..,
  {startAfterSeconds})`, linear backoff of `ANALYSIS_RETRY_DELAY_SECONDS` ×
  attempt, default 60s) then acks the current delivery. It never re-throws out of
  the pg-boss batch, so per-job isolation and idempotency (COMPLETED
  short-circuits; upsert-by-`requestId`) are preserved. Exhausted/non-retryable/
  re-enqueue-failed cases mark the job FAILED as before.
- **Provider-safety signposting** — the worker logs a one-line startup warning
  when LIVE providers (`TWITTER_PROVIDER=twitterapi` / `LLM_PROVIDER=openai`) are
  active; `.env.example` documents all caps with a public-endpoint warning.

Real per-user auth (not per-browser-cookie) and per-IP limiting remain the future
fix; `ownerId` maps onto a real user id then.

### Report Delivery & Lead Capture (Unit 24)

The report is fully viewable on screen; to **take a copy** the user leaves an
**email and/or Telegram** ("Get the full report"). Each submission is stored as
a `ReportDelivery` row (the leads table) with per-channel status. **Email**
delivers a generated **PDF**: `POST /api/analyses/[id]/deliver` (thin — validates
via `ReportDeliverInputSchema`, creates the row, enqueues) → a pg-boss
`report.deliver` job → the worker renders the PDF (`@kol-fit/report-pdf`, via
`@react-pdf/renderer`, no browser) and sends it through a **mail-provider
abstraction** (`@kol-fit/mail`): **mock** logs by default (no credentials);
**resend** sends for real behind `MAIL_PROVIDER=resend` + `RESEND_API_KEY` +
`MAIL_FROM`. **Telegram** is captured/stored only — bots can't DM a handle that
hasn't started the bot, so real Telegram delivery is deferred. Delivery is
best-effort/idempotent (a SENT row short-circuits; failures mark the row FAILED
but never lose the captured lead), and addresses/secrets are never logged.

## Analysis Depth and Cost Controls

Report depth is configurable, not hardcoded inline in pipeline stages. Centralize the following caps as named config constants (owned by `packages/shared` or a dedicated `packages/analysis` config module), with environment variable overrides where useful for local tuning:

| Cap | Default |
| --- | --- |
| KOL posts fetched | last 100 |
| KOL replies fetched | last 50 (if available) |
| Top KOL posts selected for deep analysis | 20, ranked by engagement |
| Replies fetched per selected post | up to 50 |
| Quote tweets fetched per selected post | up to 30 |
| Retweeters fetched per selected post | up to 100 |
| Unique engaged accounts per report | 1,500 maximum |

These caps must be easy to change without touching pipeline logic, since they will be tuned as real API cost/rate-limit data comes in.

**Implemented (Unit 19):** the defaults live in `packages/shared` (`ANALYSIS_CAPS`),
and `resolveCaps()` in `packages/analysis` applies `ANALYSIS_*` environment
overrides (`ANALYSIS_KOL_POSTS_FETCHED`, `ANALYSIS_KOL_REPLIES_FETCHED`,
`ANALYSIS_TOP_POSTS_FOR_DEEP_ANALYSIS`, `ANALYSIS_REPLIES_PER_POST`,
`ANALYSIS_QUOTES_PER_POST`, `ANALYSIS_RETWEETERS_PER_POST`,
`ANALYSIS_MAX_UNIQUE_ENGAGED_ACCOUNTS`); invalid/non-positive values fall back
to the default. The worker calls `resolveCaps()` and passes the result into
`runAnalysis({ caps })`, keeping the pipeline pure.

Audience classification (the dominant LLM cost) is additionally capped by
`OPENAI_AUDIENCE_CLASSIFICATION_LIMIT` (default 300). When more unique engaged
accounts are collected than that limit, the OpenAI provider selects a
**representative deterministic sample** (`sampleAudienceAccounts`): the budget
is allocated proportionally across engagement sources (REPLY/QUOTE/RETWEET) via
largest-remainder rounding, and within each source group accounts are sorted by
a stable key and picked evenly-spaced — so the sample spans the whole group
rather than clustering at the front, and is identical across cached re-runs.

Provider usage is recorded per completed report in `ProviderUsageLog` (raw
request counts, LLM token in/out/total, cache hit/miss counts in `meta`).
`costUsd` is estimated only when `LLM_INPUT_COST_PER_MTOK` /
`LLM_OUTPUT_COST_PER_MTOK` are set; raw counts are always stored so cost can be
recomputed later. Mock providers report no usage, so no rows are written for
them. Usage logging is best-effort and never fails the job.

## Website/Docs Content Ingestion

Org website/docs URLs are optional manual-context inputs. Lightweight text ingestion of these URLs is in scope; a full crawler is not.

- Fetch only the single provided URL (website and/or docs), not linked pages.
- Enforce a strict response size limit and a strict request timeout; abort and degrade gracefully past either limit.
- Parse the fetched page into compact plain text (e.g. strip markup/scripts/styles) before it is used as org-classification input or stored as evidence.
- This is not a swappable provider (there is only ever one implementation, plain HTTP fetch + HTML-to-text), so it does not need a provider interface under `packages/twitter`-style abstraction. It lives as a small module inside `packages/analysis` (e.g. `packages/analysis/website/`), used during the organization data fetch stage.
- Failure or timeout must not fail the report; it must lower confidence on inferred organization fields per the existing invariant that missing optional data degrades confidence rather than breaking the report.

## Provider Abstractions

### Twitter/X Provider Interface

All Twitter/X calls must go through an interface, not direct calls from app/worker logic.

Required methods:

```ts
getUserProfile(handle: string)
getUserTweets(handle: string, limit: number)
getUserReplies(handle: string, limit: number)
getTweetReplies(tweetId: string, limit: number)
getTweetQuotes(tweetId: string, limit: number)
getTweetRetweeters(tweetId: string, limit: number)
getFollowers(handle: string, limit: number)
searchTweets(query: string, limit: number)
```

First implementation:

```txt
TwitterApiIoProvider
```

Future implementations:

```txt
OfficialXProvider
BrightDataProvider
ApifyProvider
```

### LLM Provider Interface

All LLM calls must go through a provider abstraction.

Required capabilities:

```ts
classifyOrgProfile(input)
classifyKolContent(input)
classifyAudienceAccounts(input)
generateFitReport(input)
```

First implementation:

```txt
OpenAiProvider
```

Future implementations:

```txt
ClaudeProvider
GeminiProvider
LocalModelProvider
```

The model identifier must never be hardcoded in provider code. It is read from the `LLM_MODEL` environment variable and passed into the provider at construction/call time, so the model can be changed without a code change. The exact first model value is chosen during the live OpenAI provider unit (Unit 17), not before.

## Analysis Pipeline

The analysis pipeline should be split into stages:

1. Input normalization and validation
2. Organization data fetch
3. Organization classification
4. KOL data fetch
5. KOL content classification
6. Top-post selection
7. Engagement data fetch
8. Engaged account sampling
9. Audience classification
10. Deterministic scoring
11. Risk analysis
12. LLM report generation
13. Structured-output validation
14. Report persistence

Each stage should be testable and independently understandable.

## Invariants

1. API route handlers must not run long-lived analysis work. They may validate input, read/write lightweight records, enqueue jobs, and return status.
2. All Twitter/X data access must go through `packages/twitter/` provider interfaces.
3. All LLM calls must go through `packages/llm/` provider interfaces.
4. Scoring logic must not live in UI components or API route handlers. It belongs in `packages/scoring/`.
5. The worker must persist job status transitions: queued, running, completed, failed.
6. Every final report must include evidence/sample-size metadata and confidence level.
7. Manual org brief fields must take priority over inferred fields.
8. Missing optional data must lower confidence, not break the report unless required inputs are unavailable.
9. External input and provider responses must be validated with Zod before being trusted.
10. Secrets must only be read from environment variables and must never be committed, logged, or returned to the client.
11. Database writes must preserve enough state to debug failed jobs.
12. Report generation must return structured JSON validated before saving.
13. UI must render from saved report data, not recalculate scores client-side.
14. No feature outside the active spec should be implemented during a unit.
15. Raw provider payloads (Twitter/X or website/docs fetches) are not retained indefinitely. Only normalized entities, sample-size metadata, and the compact evidence JSON needed to explain a report are persisted. Full raw payload archival is out of scope for the first build.
16. Reports/requests must carry a nullable workspace/user reference from the first schema onward, even while auth is out of scope, so a single-internal-workspace assumption can later become real multi-user/workspace support without a breaking migration.
