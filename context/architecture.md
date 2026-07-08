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

Assume a single internal workspace for now — there is no login, no multi-tenant isolation, and no per-user access control.

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

These caps must be easy to change without touching pipeline logic, since they will be tuned as real API cost/rate-limit data comes in (see Unit 18, Caching and Cost Controls).

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
