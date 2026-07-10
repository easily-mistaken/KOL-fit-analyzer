# Unit 21: Error Handling and Reliability Pass

## Goal

Make failures understandable, safe, and consistent across the stack. Today a worker failure stores a single generic `errorCode: "worker_error"` / `errorMessage: "Worker failed to process the analysis job."` regardless of cause, and the failed report page shows only that flat text. A live run can fail for very different reasons (bad handle, provider rate-limit, invalid LLM output, timeout) that the user currently can't distinguish or act on.

This unit adds a small **error taxonomy** so provider/pipeline failures map to stable, user-facing error codes with safe, human-readable messages; records **retry metadata** (attempt count); improves the **failed report UI**; and audits **logging** so no secrets/PII leak.

Build-plan scope (Unit 21): provider error display, worker failed state, retry metadata, user-friendly failed report page, safer logging. Verification: failed jobs are understandable; errors do not expose secrets; docs updated.

Note on cross-boundary scope: this unit deliberately touches both the worker (failure classification/recording) and the web UI (failed page) because they are two ends of one cohesive concern — the error taxonomy. Keep the change small and end-to-end; the stored `errorCode`/`errorMessage` is the single source of truth the UI renders.

Explicit non-goals (later / never this unit):

- **No pg-boss auto-retry / backoff change.** The handler still catches per-job errors and marks the job FAILED (isolating the batch, preserving idempotency); it does not re-throw to let pg-boss retry. Automatic retry with backoff is a future extension (note it).
- **No in-UI "retry" button that re-enqueues** a run. The failed page links to "start a new analysis" instead. A true retry endpoint is deferred.
- No new provider/scoring/LLM logic; no new analysis behavior.
- No schema change (see below).
- No commits until verified (then one commit).

## No Schema Change (justified)

Everything needed already exists on `AnalysisJob`: `attempts Int @default(0)`, `errorCode String?`, `errorMessage String?`, `failedAt`, plus `startedAt/completedAt`. `Report` also already has `status (PENDING|COMPLETED|FAILED)`, `errorCode`, `errorMessage`. So this unit is purely code: better values into existing columns + surfacing them. **No migration.**

## Error Taxonomy (worker-side)

New `apps/worker/src/errors.ts`:

- `type AnalysisErrorCode` — a small set of **stable slugs** (persisted + shown; do not rename casually):
  - Twitter: `twitter_auth`, `twitter_rate_limited`, `twitter_not_found`, `twitter_timeout`, `twitter_unavailable`
  - LLM: `llm_auth`, `llm_rate_limited`, `llm_invalid_output`, `llm_timeout`, `llm_config`, `llm_unavailable`
  - Generic fallback: `analysis_failed`
- `classifyAnalysisError(error: unknown): { code: AnalysisErrorCode; message: string }`:
  - Maps `TwitterApiError` by its `.code` (`auth_error`→`twitter_auth`, `rate_limited`→`twitter_rate_limited`, `not_found`→`twitter_not_found`, `timeout`→`twitter_timeout`, `network_error`/`provider_error`/`invalid_response`→`twitter_unavailable`).
  - Maps `OpenAiError` by its `.code` (`auth_error`→`llm_auth`, `rate_limited`→`llm_rate_limited`, `invalid_response`/`refusal`→`llm_invalid_output`, `timeout`→`llm_timeout`, `config_error`→`llm_config`, `network_error`/`provider_error`→`llm_unavailable`).
  - Anything else → `analysis_failed`.
  - Returns a **fixed, safe, user-friendly `message`** per code (a `Record<AnalysisErrorCode, string>` in the worker) — never the raw provider/exception text, never a key, URL, or PII. Examples:
    - `twitter_not_found`: "We couldn't find one of the X/Twitter accounts. Double-check the org and KOL handles."
    - `twitter_rate_limited`: "The X/Twitter data provider is rate-limiting requests right now. Please try again shortly."
    - `llm_invalid_output`: "The analysis model returned an unexpected response. Please try again."
    - `analysis_failed`: "The analysis couldn't be completed. Please try again."
- Import the typed errors from their packages (`TwitterApiError` from `@kol-fit/twitter`, `OpenAiError` from `@kol-fit/llm`) — both are already worker dependencies (Unit 19). Use `instanceof`, with a defensive structural fallback (`error && typeof error === "object" && "code" in error` + `name`) in case of cross-realm instances.

Provider error messages are already key/PII-free (see the classes' doc comments), but the taxonomy still returns its **own** fixed copy rather than passing provider text through, so nothing provider-internal reaches the UI.

## Worker Handler Changes (`apps/worker/src/handlers/analysis-run.ts`)

- **Attempts:** at the QUEUED→RUNNING transition, `attempts: { increment: 1 }` (records how many times this job has entered processing — retry metadata).
- **Failure recording:** in the catch block, replace the generic values with `const { code, message } = classifyAnalysisError(error);` → store `errorCode: code`, `errorMessage: message` on the job (RUNNING→FAILED, `failedAt`). Keep the existing swallow-and-ack + idempotency (`COMPLETED` short-circuit) unchanged.
- **Safer logging:** log a single structured, bounded line — the classified `code` plus `error instanceof Error ? error.message : String(error)` — never the full error object, request payload, provider response body, or any env/secret. (The provider errors already scrub keys; this keeps it that way and avoids dumping arbitrary objects.) The best-effort "mark FAILED" inner catch keeps its existing guarded logging.
- Usage logging (Unit 19) stays best-effort and after success only (unchanged).

## DTO + Status Route (`/api/analyses/[id]`)

- Add `attempts: number` to `AnalysisStatusResponse["job"]` in `apps/web/lib/analysis-status.ts`.
- Populate it in `apps/web/app/api/analyses/[id]/route.ts` from `job.attempts`. No other DTO/route change. (The `errorCode`/`errorMessage` are already in the DTO.)

## Failed Report UI (`apps/web/components/analysis-status.tsx` → `FailedBody`)

Make the failed state a proper, friendly panel (ui-context: "Analysis failed with reason"):

- A clear headline + the stored safe `errorMessage` (fallback copy if null).
- A compact metadata row: the `errorCode` (mono, muted — a stable reference for support/debugging), attempt count (when > 1), and the `failedAt` timestamp (`toLocaleString`).
- Actions: a primary "Start a new analysis" link → `/`, and a secondary "Back to reports" link → `/analyses`. (No re-enqueue/retry endpoint this unit.)
- Keep it token-styled (`error` tokens for the failure accent), information-dense, no color-only meaning.

### Small consistency cleanup (in scope)

`analysis-status.tsx` still carries a **duplicate** `VERDICT_TONE` map (in `CompletedBody`) that Unit 20 centralized into `components/report/verdict-badge.tsx`. Replace that local map + inline badge with the shared `VerdictBadge` and delete the dupe (dedupe = fewer places for the verdict mapping to drift). Do not otherwise touch the polling/loading logic.

## Safer Logging Audit (repo-wide, light)

- Confirm no `console.*` logs a raw request body, provider response body, API key, `DATABASE_URL`, or full unknown error object with potential secrets. The web API routes already log sanitized messages; the worker is the main change above. Fix any found; do not add a logging library.
- Never store raw provider/stack text on the job/report — only the taxonomy's fixed messages.

## Architecture / Docs

- `context/architecture.md`: add a short "Error Handling & Failure Taxonomy" note — worker maps `TwitterApiError`/`OpenAiError` → stable `AnalysisErrorCode` + safe fixed messages recorded on `AnalysisJob` (`errorCode`/`errorMessage`/`attempts`); failures never leak provider internals/secrets; per-job errors are isolated (batch-safe) and the job is marked FAILED (no auto-retry yet).
- `context/progress-tracker.md`: mark Unit 21 done + session notes.

## Implementation Steps

1. `apps/worker/src/errors.ts`: `AnalysisErrorCode`, `classifyAnalysisError`, and the `Record<AnalysisErrorCode, string>` message map.
2. `apps/worker/src/handlers/analysis-run.ts`: increment `attempts` on RUNNING; use `classifyAnalysisError` for the FAILED record; tighten the catch-block log line.
3. `apps/web/lib/analysis-status.ts`: add `attempts` to the job DTO.
4. `apps/web/app/api/analyses/[id]/route.ts`: populate `attempts`.
5. `apps/web/components/analysis-status.tsx`: richer `FailedBody` (message + code + attempts + failedAt + actions); replace the duplicate `VERDICT_TONE`/inline badge in `CompletedBody` with the shared `VerdictBadge`.
6. `context/architecture.md` + `context/progress-tracker.md` updates.

## Dependencies

- No new npm/workspace packages. Uses existing `@kol-fit/twitter` (`TwitterApiError`), `@kol-fit/llm` (`OpenAiError`), `@kol-fit/db`, `@kol-fit/shared`, `next/link`, `lucide-react`.
- No live-network/provider calls.

## Verification Checklist

Offline (primary — `pnpm build` + `pnpm check`, plus a small worker unit check):

- [ ] `pnpm build` (all projects) + `pnpm check` green.
- [ ] **Classifier:** `classifyAnalysisError` returns the expected stable `code` for each `TwitterApiError` code, each `OpenAiError` code, a plain `Error`, and a non-Error value; every returned `message` is from the fixed map (no raw provider text); unknown → `analysis_failed`. Add these as a new `scripts/checks/*.cjs` regression wired into `pnpm check` (mirrors existing checks; imports the built worker `dist`).
- [ ] **No secret leakage:** the classifier never echoes the input error's message; feeding an error whose message contains a fake "key=SECRET" string yields a fixed map message that does **not** contain "SECRET".
- [ ] DTO/route: `attempts` present and typed; failed page renders message + code + attempts + failedAt + both action links; `CompletedBody` uses `VerdictBadge` (no duplicate `VERDICT_TONE` remains in the file).

Online (disk-light, local/throwaway Postgres, mock providers — no billable calls):

- [ ] Simulate a failure: temporarily make the injected provider throw a `TwitterApiError("not_found", ...)` (or seed a FAILED job row) → the job is marked FAILED with `errorCode: "twitter_not_found"`, the fixed friendly message, `failedAt` set, and `attempts >= 1`; `/analyses/[id]` shows the friendly failed panel; `/analyses` lists the row as FAILED.
- [ ] A normal mock run still completes COMPLETED with `attempts = 1` (increment doesn't break the happy path).

Scope guardrails:

- [ ] No schema/migration change; `errorCode`/`errorMessage`/`attempts` columns reused.
- [ ] No pg-boss retry/delivery change; per-job isolation + idempotency preserved; happy path unchanged.
- [ ] No provider/scoring/LLM logic change; providers stay behind their interfaces.
- [ ] No secrets/PII in stored errors or logs.
- [ ] `context/progress-tracker.md` + `context/architecture.md` updated. One commit after verification.

## Open Questions / Design Decisions

- **Retry semantics:** record attempts + keep swallow-and-mark-FAILED (recommended, safe, preserves batch isolation) vs wiring pg-boss retry/backoff (changes delivery semantics — defer). Recommend record-only now.
- **Failed-page action:** "start a new analysis" link (recommended) vs a re-enqueue "retry" button (needs a new endpoint + idempotency story — defer).
- **Where the taxonomy lives:** worker module `apps/worker/src/errors.ts` (recommended — it's the only place that catches pipeline/provider errors and already depends on both provider packages) vs `packages/shared` (would pull provider error types into shared). Recommend the worker module; the UI only consumes the persisted `errorCode`/`errorMessage` strings.
- **Failed Report row:** also mirror the failure onto a `Report` row (`status: FAILED`) or keep it on the job only (current UI reads the job)? Recommend job-only this unit (the list/detail already derive FAILED from the job); note Report-mirroring as optional.
