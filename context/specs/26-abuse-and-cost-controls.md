# Unit 26 — Abuse & Cost Controls (denial-of-wallet mitigation)

## Problem

`POST /api/analyses` is public, unauthenticated, and unthrottled, yet each
submission fans out to real paid TwitterAPI.io + OpenAI spend (hundreds of
paginated Twitter calls + audience classification per run). The per-browser
`kolfit_owner` cookie scopes report *visibility* only — it does not gate *who
can trigger work*. With live providers configured (`TWITTER_PROVIDER=twitterapi`,
`LLM_PROVIDER=openai`), anyone/any bot can create unlimited analyses with fresh
handles (defeating the input-keyed cache) → unbounded third-party spend.

This unit bounds worst-case spend and adds transient-failure retry, without
introducing new infrastructure (no Redis; DB-backed, matching the architecture's
"database-backed first" principle). Real multi-user auth remains a future unit;
`ownerId`/`workspaceId` already map onto a real user id then.

## Scope

In scope:
1. A **circuit-breaker + per-owner rate limit** in front of analysis creation.
2. **Transient-failure retry** for `analysis.run` jobs (bounded, backed off).
3. **Provider-safety** signposting (`.env.example` + worker startup warning).
4. A regression check wired into `pnpm check`; context + progress updates.

Out of scope: real auth/login, per-IP limiting (needs storing IPs — privacy +
schema change), CAPTCHA, a spend dashboard.

## 1. Abuse limits (config)

New `packages/shared/src/limits.ts` (exported from `packages/shared/src/index.ts`):

```ts
export interface AbuseLimits {
  perOwnerPerDay: number;   // max analyses one owner cookie may create per rolling 24h
  globalPerDay: number;     // max analyses across ALL owners per rolling 24h (the spend ceiling)
  maxDailySpendUsd: number; // refuse when summed ProviderUsageLog cost in 24h >= this; 0 = disabled
}

export const ABUSE_LIMITS: AbuseLimits = {
  perOwnerPerDay: 10,
  globalPerDay: 200,
  maxDailySpendUsd: 0,
};

export const ABUSE_LIMIT_ENV_VARS: Record<keyof AbuseLimits, string> = {
  perOwnerPerDay: "MAX_ANALYSES_PER_OWNER_PER_DAY",
  globalPerDay: "MAX_ANALYSES_PER_DAY",
  maxDailySpendUsd: "MAX_DAILY_SPEND_USD",
};

// Pure resolver — env overrides on top of defaults. perOwnerPerDay/globalPerDay
// must be > 0 to override (invalid/absent → default). maxDailySpendUsd accepts
// >= 0 (0 disables); invalid/absent → default.
export function resolveAbuseLimits(env?: Record<string, string | undefined>): AbuseLimits;
```

Follow the `resolveCaps`/`posInt` idiom already in the repo.

## 2. Rate-limit check (web)

New `apps/web/lib/rate-limit.ts`:

```ts
export type LimitDecision = { allowed: true } | { allowed: false; message: string };

// Reads saved DB counts only (no provider calls). Rolling 24h window.
export async function checkAnalysisRateLimit(ownerId: string): Promise<LimitDecision>;
```

Logic (window = now − 24h):
- `perOwner` = `prisma.analysisRequest.count({ where: { ownerId, createdAt: { gte: since } } })`.
  If `>= limits.perOwnerPerDay` → `{ allowed:false, message:"You've reached the daily limit for new analyses from this browser. Please try again later." }`.
- `global` = `prisma.analysisRequest.count({ where: { createdAt: { gte: since } } })`.
  If `>= limits.globalPerDay` → `{ allowed:false, message:"The analyzer is at capacity right now. Please try again a little later." }`.
- If `limits.maxDailySpendUsd > 0`: sum `ProviderUsageLog.costUsd` over the window
  (verify the timestamp column name — `createdAt`; if the model has no usable
  timestamp, skip the spend gate rather than guess). If the summed cost
  `>= limits.maxDailySpendUsd` → `{ allowed:false, message:"The analyzer has hit its daily budget. Please try again tomorrow." }`.
- Else `{ allowed:true }`.

Resolve limits via `resolveAbuseLimits(process.env)`.

## 3. Route wiring (`apps/web/app/api/analyses/route.ts` POST)

After `ensureOwnerId()`, before the `analysisRequest.create`:

```ts
const decision = await checkAnalysisRateLimit(ownerId);
if (!decision.allowed) return json(err("rate_limited", decision.message), 429);
```

`rate_limited` is already in `ApiErrorCode`. Return HTTP **429**. Keep this inside
the existing `try` so DB-count errors fall through to the 500 path (no leak).
`json()`'s type is `ApiResponse<AnalysisCreated>`; the `err(...)` value is
`ApiResponse<never>` and already flows through elsewhere — keep types clean (cast
consistent with existing usage; do not weaken types beyond what the file already does).

## 4. Transient-failure retry (worker + queue)

### Retryable classification — `apps/worker/src/errors.ts`
Add and export:
```ts
export const RETRYABLE_CODES: ReadonlySet<AnalysisErrorCode> = new Set([
  "twitter_rate_limited", "twitter_timeout", "twitter_unavailable",
  "llm_rate_limited", "llm_timeout", "llm_unavailable",
]);
export function isRetryable(code: AnalysisErrorCode): boolean;

// Pure, fully unit-testable decision (no IO):
export function decideRetry(args: { code: AnalysisErrorCode; attempts: number; maxAttempts: number }):
  { retry: boolean };
// retry === isRetryable(code) && attempts < maxAttempts
```
Terminal (never retried): auth, config, not_found, invalid_output, analysis_failed.

### Delayed re-enqueue — `packages/queue/src/enqueue.ts`
Extend `enqueueAnalysisRun` with an optional delay (pg-boss `send` `startAfter`,
seconds):
```ts
export async function enqueueAnalysisRun(
  payload: AnalysisRunPayload,
  opts?: { startAfterSeconds?: number }
): Promise<string>;
```
Web callers pass no opts (unchanged behavior). When `startAfterSeconds` is a
positive finite number, pass `{ startAfter: Math.trunc(startAfterSeconds) }` to
`boss.send`.

### Handler catch block — `apps/worker/src/handlers/analysis-run.ts`
Read config in the handler (worker-side; follow the env idiom):
`ANALYSIS_MAX_ATTEMPTS` (default 3, min 1) and `ANALYSIS_RETRY_DELAY_SECONDS`
(default 60, min 1). `job.attempts` was already incremented at the QUEUED→RUNNING
transition (so first run = 1).

Replace the current "always mark FAILED" catch with:
```ts
const { code, message } = classifyAnalysisError(error);
// safe log (unchanged: code + bounded message only, never the raw error object beyond .message)
if (decideRetry({ code, attempts: job.attempts, maxAttempts }).retry) {
  try {
    // Leave the job retryable and re-enqueue with backoff. Preserves per-job
    // isolation (we ACK this delivery by returning) + idempotency (the re-run
    // re-enters processAnalysisRun; COMPLETED short-circuits; upsert-by-requestId
    // never duplicates). attempts keeps climbing until it hits maxAttempts.
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: { status: "QUEUED", errorCode: code, errorMessage: message },
    });
    await enqueueAnalysisRun(
      { requestId, jobId },
      { startAfterSeconds: retryDelaySeconds * job.attempts } // linear backoff
    );
    console.warn(`[worker] analysis.run for request ${requestId} failed (${code}); retry ${job.attempts}/${maxAttempts} scheduled.`);
    return; // ack this delivery; the delayed job drives the retry
  } catch (reEnqueueError) {
    console.error(`[worker] failed to schedule retry for job ${jobId}; marking FAILED:`, reEnqueueError);
    // fall through to terminal FAILED
  }
}
// terminal (non-retryable OR attempts exhausted OR re-enqueue failed)
await prisma.analysisJob.update({ where:{id:jobId}, data:{ status:"FAILED", failedAt:new Date(), errorCode:code, errorMessage:message }});
```
Do NOT re-throw out of the batch handler (that would risk the whole pg-boss
batch). Retry is driven exclusively by the explicit delayed re-enqueue.

Import `enqueueAnalysisRun` from `@kol-fit/queue` in the handler.

## 5. Provider-safety signposting

- `apps/worker/src/index.ts` `main()`: after boot, if
  `process.env.TWITTER_PROVIDER === "twitterapi"` or
  `process.env.LLM_PROVIDER === "openai"`, `console.warn` a one-line notice that
  LIVE providers are active and real spend will be incurred (name which ones).
  No secrets in the message.
- `.env.example`: add a commented block for the new vars with a short warning
  that the endpoint is public and these bound worst-case spend:
  ```
  MAX_ANALYSES_PER_OWNER_PER_DAY=10
  MAX_ANALYSES_PER_DAY=200
  MAX_DAILY_SPEND_USD=0
  ANALYSIS_MAX_ATTEMPTS=3
  ANALYSIS_RETRY_DELAY_SECONDS=60
  ```

## 6. Regression check

New `scripts/checks/abuse-and-retry.regression.cjs`, wired into the `check`
script (and a `check:abuse-and-retry` alias) in root `package.json`. No network,
no DB, no keys. Import compiled dist:
- `resolveAbuseLimits` from `packages/shared/dist/index.js`:
  - defaults when env empty (10 / 200 / 0);
  - env overrides applied (`MAX_ANALYSES_PER_OWNER_PER_DAY=3` → 3, etc.);
  - invalid/negative count env → default; `MAX_DAILY_SPEND_USD=0` stays 0 (disabled); a valid positive spend override applies.
- `isRetryable` / `decideRetry` from `apps/worker/dist/errors.js`:
  - each retryable code → retry true when attempts < max;
  - each terminal code (auth/config/not_found/invalid_output/analysis_failed) → retry false;
  - attempts === maxAttempts → retry false (exhausted);
  - attempts > maxAttempts → false.
- Assert `RETRYABLE_CODES` contains exactly the six expected codes.
Print an `ABUSE & RETRY REGRESSION: N passed, M failed` summary and
`process.exit(fail === 0 ? 0 : 1)`.

## 7. Docs

- `context/architecture.md`: add an "Abuse & Cost Controls (Unit 26)" subsection
  under the auth/access or background-job area describing the two count caps +
  optional spend cap + the retry model; note real auth is still the future fix.
- `context/progress-tracker.md`: add a Unit 26 Completed entry (convert any
  relative dates to absolute) and update Current Phase/Goal.

## Invariants preserved

- API route still only validates + writes lightweight records + enqueues (the
  rate check is two `count()` reads — not analysis work).
- Per-job isolation and idempotency of the worker are preserved (retry is a
  delayed re-enqueue; COMPLETED short-circuits; upsert-by-requestId).
- No secrets/PII in logs or responses. No new npm dependencies. No Prisma schema
  change (uses existing `AnalysisRequest.createdAt`/`ownerId` +
  `ProviderUsageLog`).

## Acceptance

- `pnpm build` green across all projects.
- `pnpm check` green (all suites incl. the new one).
- Manually reason through: 11th analysis from one owner within 24h → 429;
  201 path unchanged when under limits; a `twitter_rate_limited` failure with
  attempts<max re-enqueues (job returns to QUEUED) and a terminal `twitter_auth`
  failure marks FAILED immediately.
