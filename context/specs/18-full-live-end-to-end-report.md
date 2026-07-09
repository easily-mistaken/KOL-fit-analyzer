# Unit 18: Live End-to-End Report

## Goal

Run one complete org-vs-KOL analysis through the **live** providers — TwitterAPI.io (Unit 16) + OpenAI (Unit 17) — over the existing pipeline/worker/queue/API/report-renderer, and verify the full lifecycle: submit real handles → queue → worker → pipeline (live Twitter fetch + deterministic scoring + live OpenAI narrative) → saved `Report` → status UI → 15-section report UI, with failures handled clearly.

This is a **connect-and-verify** unit, not a redesign. The live path is already wired: the worker loads the repo-root `.env` first, and `run-analysis.ts` defaults its providers to the env-driven factories `createTwitterProvider()` / `createLlmProvider()`. So selecting live is purely configuration (`TWITTER_PROVIDER=twitterapi`, `LLM_PROVIDER=openai` + keys). **No code changes are expected.**

Explicit non-goals (later units / never):

- No caching/cost controls (Unit 19), no auth, no reports list (Unit 20), no share/export, no richer error UI (Unit 21).
- No pipeline/scoring/Prisma-schema redesign; no broad refactors.
- No commits. **Never paste/echo/commit secrets; never log keys.**

## No Code Changes Expected (and the exception)

Verified wiring (nothing to build):

- `apps/worker/src/index.ts` imports `./env.js` first → root `.env` populates `process.env` before any job runs.
- `packages/analysis/src/pipeline/run-analysis.ts`: `twitter = options.twitter ?? createTwitterProvider()`, `llm = options.llm ?? createLlmProvider()`; the factories resolve `TWITTER_PROVIDER`/`LLM_PROVIDER` (default `mock`).
- `apps/worker/src/handlers/analysis-run.ts` calls `runAnalysis(requestData)` with **no** provider options → env selects mock vs live.
- Provider-kind evidence + `Report.llmModel` already flow from env/model, so a live report is self-labeling (`twitter=twitterapi, llm=openai (model …)`).

**Exception (per scope):** if the *controlled live run* reveals that a live provider's normalized output is incompatible with the pipeline, fix it in the **provider** (`packages/twitter` or `packages/llm` normalization) — not the pipeline. If a live failure produces a genuinely broken/unclear state beyond a generic `FAILED` job, **stop and explain** before any worker/error-mapping change (richer error surfacing is Unit 21). Do not change scoring or the schema; if a real bug there is found, stop and explain first.

## Live Provider Selection Behavior

- Selection is entirely via env, resolved inside the existing factories: `TWITTER_PROVIDER=twitterapi` → `TwitterApiProvider` (needs `TWITTERAPI_IO_KEY`); `LLM_PROVIDER=openai` → `OpenAiLlmProvider` (needs `OPENAI_API_KEY` + `LLM_MODEL`).
- **Fail-fast:** a missing `TWITTERAPI_IO_KEY` / `OPENAI_API_KEY` / `LLM_MODEL` throws a typed `config_error`/`auth_error` from the factory → the worker records the job `FAILED` (no silent fallback to mock).
- **Mock stays the default** whenever the vars are unset (`mock`), so offline dev is unchanged.
- Only the **worker** process needs the provider env (it runs the pipeline). The web/API process only needs `DATABASE_URL`/`DIRECT_URL`/`NEXT_PUBLIC_APP_URL` (it just creates the request + enqueues).

## End-to-End Flow

Unchanged from Units 05–15, now with live providers in the worker:

1. **UI** (`/`) → submit org/KOL handles (+ optional brief) → `POST /api/analyses` creates `AnalysisRequest` + `AnalysisJob(QUEUED)` and enqueues `analysis.run`.
2. **Status page** `/analyses/[id]` polls `GET /api/analyses/[id]` (QUEUED → RUNNING → COMPLETED/FAILED).
3. **Worker** consumes the job → `QUEUED→RUNNING` → `runAnalysis(requestData)`:
   - live Twitter: org+KOL profiles, KOL posts/replies (caps), top-N posts, per-post replies/quotes/retweeters → engaged accounts;
   - live OpenAI: `classifyOrgProfile`, `classifyKolContent`, `classifyAudienceAccounts` (capped `OPENAI_AUDIENCE_CLASSIFICATION_LIMIT`, ≤100/batch, deterministic distribution);
   - **deterministic scoring** (`packages/scoring`) → `scores` + `verdict`;
   - live OpenAI `generateFitReport` writes **narrative only**; the provider injects the deterministic scores/verdict;
   - `FitReportSchema`-validated `FitReport` returned.
4. **Persist** → `Report` upsert (COMPLETED, real `llmModel`), `RUNNING→COMPLETED`.
5. **Report UI** renders the saved `FitReport` + 9-metric `ScoreBreakdown` (Unit 15). `performWebIngestion` stays `false`, so org context comes from the Twitter profile + manual brief (website/docs ingestion is a future toggle, out of scope here).

## Environment Setup

Add these to your **local `.env`** (repo root; already git-ignored — never commit it, never paste the values here). `.env.example` documents them.

| Var | Purpose |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Postgres (your Supabase or a local instance) — needed by web + worker |
| `TWITTER_PROVIDER=twitterapi` | select the live Twitter provider (worker) |
| `TWITTERAPI_IO_KEY=…` | TwitterAPI.io key (worker) |
| `LLM_PROVIDER=openai` | select the live OpenAI provider (worker) |
| `OPENAI_API_KEY=…` | OpenAI key (worker) |
| `LLM_MODEL=…` | a Structured-Outputs-capable model (GPT‑4o+) |
| `NEXT_PUBLIC_APP_URL=http://localhost:3000` | web |

Optional: `OPENAI_AUDIENCE_CLASSIFICATION_LIMIT` (default 300), `OPENAI_TIMEOUT_MS`, `TWITTERAPI_IO_TIMEOUT_MS`, `OPENAI_BASE_URL`, `TWITTERAPI_IO_BASE_URL`. To revert to offline, set `TWITTER_PROVIDER=mock` + `LLM_PROVIDER=mock` (or unset).

## Cost / Billing Warnings

- **A live run makes real, billable API calls.** TwitterAPI.io: roughly `~2 profiles + KOL posts/replies (paged to caps) + top-20 posts × (replies + quotes + retweeters)` ≈ tens–~130 requests depending on KOL activity (TwitterAPI.io ≈ $0.15/1k tweets, $0.18/1k profiles → typically a few cents). OpenAI: `org + kolContent + ⌈classified/100⌉ audience batches (≤3 at the 300 cap) + report` ≈ 5–6 Structured-Outputs calls (cost depends on `LLM_MODEL`). Total is usually low but **non-zero**.
- A run may take **~1–5 minutes** (many Twitter pages + several 60s-timeout OpenAI calls).
- **Before any command that makes billable calls, warn explicitly and require the user's approval.** Do **not** run a live verification automatically. Make **one controlled run** only, with a single low-risk handle pair.
- Token/request usage is available in-memory via each provider's `getUsageStats()` (not persisted) for a rough cost read; keep it out of shared logs and never print keys.

## Failure Handling

- Provider errors propagate out of `runAnalysis`; the worker's existing `try/catch` records the job `FAILED` (`errorCode: "worker_error"`, a sanitized generic message) and the status UI shows "Analysis failed". Specific causes are visible in the **worker server logs** (the typed `TwitterApiError`/`OpenAiError` — which contain **no key/PII**); richer per-code UI messaging is Unit 21.
- Expected live failure modes and the correct response (record, don't refactor):
  - **auth_error (401/403):** bad/missing key → check `.env`; job FAILED.
  - **rate_limited (429):** back off / retry later; job FAILED.
  - **not_found (bad/suspended/private handle):** a missing KOL's `getUserTweets` can throw `not_found` → job FAILED; use valid active handles.
  - **timeout / network_error:** transient; retry.
  - **OpenAI invalid_response/refusal:** the provider already repair-retries then fails typed → job FAILED (never persists an invalid report).
- Graceful degradation still applies where the provider returns data: a null profile or empty engagement lowers confidence rather than crashing (Invariant 8).
- If a controlled live run fails on an external limit/auth/handle issue, **record the observed error clearly in the tracker (no secrets) and stop** — do not change architecture to chase an external failure.

## Report Validation Behavior

- The persisted report is always `FitReportSchema`-valid: `run-analysis.ts` validates the final `FitReport`; the OpenAI provider `safeParse`s before returning (repair-retry, else typed error — invalid output is never persisted); the `[id]` route re-validates defensively on read.
- **Numeric scores come only from `packages/scoring`** (`scoreAnalysis`); the OpenAI `generateFitReport` schema contains no score/verdict fields and the provider injects the deterministic values — so a live report's numbers are deterministic and OpenAI supplies narrative/interpretation only.
- `Report.scores` is the full 9-metric `ScoreBreakdown`; `Report.llmModel` records the real model.

## Worker Integration Behavior

- Unchanged: the worker validates the payload, drives `QUEUED→RUNNING→COMPLETED/FAILED`, calls `runAnalysis` (it does **not** build the report), and upserts the single `Report` by unique `requestId` (idempotent on retry). It remains persistence/orchestration only.
- The only observable live difference vs mock: real data, real `llmModel`, provider-kind evidence `twitter=twitterapi, llm=openai`, and longer runtime.

## UI / Report Verification Behavior

- Status page transitions QUEUED → RUNNING → COMPLETED (or FAILED with a clear message).
- The completed report renders via `FitReportView` (Unit 15): hero verdict/overall/confidence, the 9-metric matrix (risk metrics flagged "higher is worse"), best/weak use cases, audience match + breakdown bars, content/engagement, paid-promo/bot-farm/brand-safety/geo, recommended angle, and evidence (sample sizes incl. `engagedAccounts` vs `engagedAccountsClassified`, plus notes naming the live providers/model).
- UI renders saved DB state only — no recomputation, no provider/LLM calls from the browser.

## Implementation Steps

1. **Confirm wiring (no code change):** re-verify the env-driven selection and that the worker passes no provider options (done in this spec).
2. **Offline verification** (no keys): `pnpm build`; confirm mock is still the default and a full mock run produces a `FitReportSchema`-valid report; confirm the factories return the live provider classes only when the env + keys are set (already covered by Units 16/17 unit checks — re-assert at the integration level).
3. **Prepare the manual live procedure** (below) and **stop for explicit approval** before any billable call.
4. **On approval only:** ensure live env is set; run **one** controlled end-to-end with a single low-risk pair; observe status → report; inspect the saved `Report`.
5. **If a normalization incompatibility surfaces:** fix in the provider (not the pipeline). **If anything else needs a code/schema/scoring change:** stop and explain first.
6. Record the outcome (success or the clearly-stated external failure) in `context/progress-tracker.md` — **no secrets**.

## Manual Live Verification Process (run only after explicit approval)

Prereqs: live env set in `.env` (above), a reachable Postgres, `pnpm build` green.

1. Start the DB (existing Supabase/local), the worker (`node apps/worker/dist/index.js`), and the web app (`pnpm --filter web dev`) — all reading the same `.env`.
2. In the UI, submit **one low-risk, well-known, active, public** pair so the run completes — e.g. org `@Uniswap`, KOL `@VitalikButerin` (substitute your own; handles are normalized). Only **one** submission.
3. Watch `/analyses/[id]` poll QUEUED → RUNNING → COMPLETED (~1–5 min). If FAILED, read the worker log for the typed cause (no key) and record it.
4. Confirm the report renders (all sections, 9 metrics, real provider/model evidence).
5. Optionally inspect the row: `Report` COMPLETED, `report` validates `FitReportSchema`, `scores` is a `ScoreBreakdown`, `overallScore`/`verdict` match `scores`, `llmModel` = the real model.
6. Revert to `mock` when done to avoid accidental billable runs.

I will **not** ask for keys in chat; I will only tell you which vars to add to `.env`, and I will **not** trigger a billable run without your explicit go-ahead.

## Dependencies

- **None new.** No new npm packages, no schema/migration, no new workspace deps. Pure configuration + verification over already-built code.

## Verification Checklist

Offline (primary — no keys, runs in CI):
- [ ] `pnpm build` passes across all workspace projects.
- [ ] With provider env unset (or `=mock`), `createTwitterProvider()`/`createLlmProvider()` return the mocks, and a full mock `runAnalysis` produces a `FitReportSchema`-valid report (regression that Unit 18 changed nothing).
- [ ] With `TWITTER_PROVIDER=twitterapi`+`TWITTERAPI_IO_KEY` and `LLM_PROVIDER=openai`+`OPENAI_API_KEY`+`LLM_MODEL` set (dummy values), the factories construct `TwitterApiProvider`/`OpenAiLlmProvider` (no network call made by construction); missing keys/model → typed `config_error`/`auth_error`.
- [ ] No secret is logged/printed by the providers/pipeline/worker (grep: keys only read from env → provider headers; no `console.*` of keys).

Manual live (optional — only with real keys in `.env` and explicit approval; not CI):
- [ ] One controlled run of a low-risk pair completes: job QUEUED→RUNNING→COMPLETED, report renders, `Report` is `FitReportSchema`-valid with deterministic `scores`, `verdict`, and real `llmModel`; evidence shows `twitter=twitterapi, llm=openai`.
- [ ] A deliberate bad/missing config (e.g. wrong key) yields a clear `FAILED` job + status message, with the typed cause in the worker log and **no key leaked**.

Scope guardrails:
- [ ] No code changes beyond (at most) a provider-normalization fix if the live run proves one necessary; no pipeline/worker/scoring/schema/UI redesign.
- [ ] TwitterAPI.io logic stays in `packages/twitter`; OpenAI logic stays in `packages/llm`; the worker builds no report; scores come from `packages/scoring`; OpenAI writes narrative only.
- [ ] `context/progress-tracker.md` updated. No commits.
