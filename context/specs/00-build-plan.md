# Build Plan

This file defines the first complete build sequence for Crypto KOL Fit Analyzer.

Each unit should be implemented one at a time. Each unit should produce a visible or verifiable result. Do not jump ahead or combine unrelated units.

## Phase 1: Project Foundation

### Unit 01: Repository Scaffold and Tooling

Build the base monorepo structure:

```txt
apps/web
apps/worker
packages/db
packages/shared
packages/twitter
packages/llm
packages/scoring
packages/analysis
context/specs
```

Set up:

- pnpm workspaces (`pnpm-workspace.yaml`)
- TypeScript
- git initialization with a standard `.gitignore` (no commits made unless explicitly requested)
- Next.js app
- shared package imports
- lint/build scripts (pnpm-compatible workspace commands)
- environment example file

Dependencies introduced:

- Next.js
- TypeScript
- pnpm workspace tooling

Verification:

- `pnpm build` passes.
- Web app starts locally.
- Worker package can compile.
- Shared package can be imported.
- Git repository is initialized with `.gitignore` in place; no commits exist yet unless explicitly requested.

See `context/specs/01-project-scaffold.md` for the detailed implementation spec.

---

### Unit 02: UI Theme and App Shell

Build the initial dashboard shell with Tailwind and shadcn/ui.

Includes:

- dark theme tokens
- app shell layout
- top navigation
- placeholder home page
- basic card styling

Dependencies introduced:

- Tailwind CSS
- shadcn/ui
- Lucide React

Verification:

- Home page renders.
- Theme matches `ui-context.md`.
- No API or database logic added.

---

### Unit 03: Database and Prisma Setup

Set up Supabase Postgres connection through Prisma.

Create initial schema for:

- AnalysisRequest
- AnalysisJob
- AnalysisReport
- ProviderUsageLog

Keep schema minimal but future-compatible. `AnalysisRequest` and `AnalysisReport` must include a nullable `workspaceId` (or equivalent) field from the start, even though auth/workspaces are out of scope for this build — assume a single internal workspace for now.

Dependencies introduced:

- Prisma
- PostgreSQL client dependencies

Verification:

- Prisma schema compiles.
- Migration can be generated/applied.
- Database client can connect.
- No worker or analysis logic yet.

---

### Unit 04: API Response and Shared Schemas

Create shared Zod schemas and API response helpers.

Includes:

- analysis request input schema
- job status enum
- report verdict enum
- score schema placeholder
- standard API success/error response shape

Verification:

- Shared schemas compile.
- API response helpers can be imported by web routes.
- No real analysis job creation yet.

---

## Phase 2: Job Creation and Worker Foundation

### Unit 05: Analysis Request API

Create API route to submit an analysis request.

Route behavior:

- validate input
- create AnalysisRequest
- create AnalysisJob with queued status
- return job/report identifier

Do not run analysis yet.
Do not call TwitterAPI.io yet.

Verification:

- Valid request creates DB records.
- Invalid request returns validation error.
- Response shape is consistent.

---

### Unit 06: pg-boss Queue Setup

Install and configure pg-boss.

Includes:

- queue initialization
- enqueue helper
- job name constants
- worker-safe queue config

Update Unit 05 route so it enqueues `analysis.run` after creating DB records.

Verification:

- Request creates DB records and enqueues job.
- No real job processing yet.

---

### Unit 07: Worker Process Skeleton

Create worker app that starts, connects to DB/pg-boss, and registers `analysis.run` handler.

Handler behavior for now:

- mark job running
- wait/mock simple processing
- mark job completed with placeholder report

Verification:

- Worker can process a queued job.
- Job status changes queued → running → completed.
- Placeholder report is saved.

---

## Phase 3: Basic UI Flow

### Unit 08: Analysis Form UI

Build frontend form for analysis submission.

Fields:

- org handle
- KOL handle
- website URL optional
- docs URL optional
- product category optional
- target user optional
- campaign goal optional
- stage optional
- region/language optional

Behavior:

- client-side validation for obvious missing fields
- submit to API
- redirect or show job status after submit

Verification:

- User can submit form.
- Job is created.
- User sees job/report status page.

---

### Unit 09: Report Status Page

Build report status page.

States:

- queued
- running
- completed
- failed

For completed placeholder reports, show placeholder report card.

Verification:

- Status page polls or refreshes job status.
- Completed placeholder report renders.
- Failed status renders error message.

---

## Phase 4: Provider Abstractions and Mock Mode

### Unit 10: Twitter Provider Interface and Mock Provider

Create `packages/twitter` provider interface.

Methods:

- getUserProfile
- getUserTweets
- getUserReplies
- getTweetReplies
- getTweetQuotes
- getTweetRetweeters
- getFollowers
- searchTweets

Create mock provider with fixture data.

Verification:

- Worker can call mock provider.
- No live TwitterAPI.io calls yet.

---

### Unit 11: LLM Provider Interface and Mock Provider

Create `packages/llm` provider interface.

Methods:

- classifyOrgProfile
- classifyKolContent
- classifyAudienceAccounts
- generateFitReport

Create mock provider returning valid structured outputs. The interface must accept a model identifier (sourced from `LLM_MODEL` at the call site later) rather than hardcoding a model name, even though the mock provider ignores it.

Verification:

- Worker can call mock LLM provider.
- Structured output validates.

---

### Unit 12: Website/Docs Content Fetch Module

Create a lightweight website/docs content fetch module inside `packages/analysis` (e.g. `packages/analysis/website/`). This is not a swappable provider — it is a single plain HTTP-fetch-and-parse implementation, so it does not get a `packages/twitter`-style interface.

Behavior:

- Fetch only the single provided website URL and/or docs URL (no crawling of linked pages).
- Enforce a strict response size limit and a strict request timeout.
- Parse fetched HTML into compact plain text (strip scripts/styles/markup).
- On failure, timeout, or oversized response, return a clear "unavailable" result instead of throwing — this must lower confidence on inferred org fields later, not break the pipeline.

Verification:

- Fetching a valid small page returns compact plain text.
- Fetching a URL that exceeds the size limit or timeout returns a graceful "unavailable" result, not a crash.
- No crawling of links beyond the provided URL occurs.

---

### Unit 13: Analysis Pipeline Skeleton

Create `packages/analysis` pipeline using mock Twitter and mock LLM providers, plus the website/docs content fetch module from Unit 12.

Pipeline stages:

1. normalize input
2. fetch org data (including optional website/docs content fetch)
3. fetch KOL data
4. select top KOL posts
5. fetch engagement samples
6. classify org
7. classify KOL content
8. classify audience
9. run placeholder scoring
10. generate report
11. return validated report object

Pipeline stages must respect the default analysis depth/cost caps defined in `architecture.md` (Analysis Depth and Cost Controls) rather than using ad hoc limits.

Verification:

- Worker uses analysis pipeline instead of placeholder report.
- Report output is deterministic from mock fixtures.
- Depth/cost caps are read from centralized config, not inlined per stage.

---

## Phase 5: Scoring and Report Shape

### Unit 14: Scoring Module

Implement scoring module.

Scores:

- overall_fit
- content_fit
- engaged_audience_match
- audience_quality
- campaign_goal_fit
- geo_language_fit
- brand_safety
- paid_promo_risk
- bot_farm_risk

Use default weights:

- Engaged audience match: 35%
- Audience quality: 20%
- Content fit: 15%
- Campaign goal fit: 15%
- Brand safety: 10%
- Geo/language fit: 5%

Verification:

- Scoring functions are deterministic.
- Basic tests or fixture checks pass.
- Overall score can be explained from components.

---

### Unit 15: Final Report Schema and Renderer

Define final report JSON schema and render it in the UI.

Report sections:

1. Overall Fit Score
2. Final Verdict
3. Best Use Cases
4. Weak Use Cases
5. Audience Match
6. Audience Breakdown
7. KOL Content Analysis
8. Engagement Quality
9. Paid Promo Detection
10. Bot/Farm Risk
11. Brand Safety
12. Geo/Language Fit
13. Recommended Campaign Angle
14. Evidence and Sample Size
15. Confidence Level

Verification:

- Saved report JSON validates.
- UI renders every required section.
- Missing optional sections degrade gracefully.

---

## Phase 6: Live Integrations

### Unit 16: TwitterAPI.io Provider

Implement live TwitterAPI.io provider behind the existing interface.

Requirements:

- environment variable for API key
- normalized outputs
- error mapping
- basic rate/error handling
- usage logging where available

Do not change analysis pipeline contracts.

Verification:

- Provider can fetch a user profile.
- Provider can fetch user tweets.
- Provider can fetch at least one engagement type available through API.
- Worker can run with live provider on a small test case.

---

### Unit 17: OpenAI Provider

Implement live OpenAI provider behind the existing interface.

Requirements:

- API key read from `OPENAI_API_KEY`
- model name read from `LLM_MODEL` (never hardcoded); this is where the first real model value is chosen
- structured JSON output
- schema validation
- model name stored with report/evidence metadata
- graceful failure when output is invalid

Verification:

- Mock provider can still be used.
- Live provider can classify fixture data.
- Invalid LLM output does not save broken reports.

---

### Unit 18: Live End-to-End Report

Run a complete org-vs-KOL analysis using live TwitterAPI.io and live LLM provider.

Requirements:

- full job lifecycle
- saved report
- status UI
- final report UI
- evidence/sample-size metadata

Verification:

- User can submit a real pair of handles.
- Worker completes the report.
- Report renders in UI.
- Errors are handled clearly.

---

## Phase 7: Quality, Cost, and Internal Use

### Unit 19: Caching and Cost Controls

Add database-backed caching for provider data.

Cache:

- profiles
- recent tweets
- engagement samples where useful

Add basic cost/sampling controls, making the default caps from `architecture.md` (Analysis Depth and Cost Controls) adjustable:

- max tweets per report
- max top posts for deep analysis
- max engaged accounts sampled
- provider usage logs

Verification:

- Repeated requests reuse cached data when valid.
- User/report settings control sample size.
- Provider usage logs are saved.

---

### Unit 20: Reports List and Saved Report History

Build saved reports list.

Includes:

- list reports
- status
- org/KOL handles
- created date
- verdict
- score
- open report

Verification:

- Completed reports are visible from dashboard.
- User can open old reports.

---

### Unit 21: Error Handling and Reliability Pass

Improve failure states and debugging.

Includes:

- provider error display
- worker failed state
- retry metadata
- user-friendly failed report page
- safer logging

Verification:

- Failed jobs are understandable.
- Errors do not expose secrets.
- Progress tracker and architecture docs updated if needed.

---

## Later Phases, Not First Build

Do not build these unless a later spec explicitly adds them:

- auth/workspaces
- public share links
- PDF export
- KOL discovery
- campaign CRM
- client portal
- payments
- on-chain attribution
- Telegram/Discord/YouTube/TikTok analysis
- Redis/BullMQ migration
- pgvector historical intelligence
