# Unit 07: Worker Process Skeleton and Placeholder Report

## Goal

Build the first real worker: a standalone Node process that starts pg-boss, consumes `analysis.run` jobs, drives the `AnalysisJob` status lifecycle (QUEUED → RUNNING → COMPLETED/FAILED), and saves a **clearly-marked placeholder `Report`** linked to the request. This closes the first end-to-end loop — `POST /api/analyses` → enqueue → worker → completed job + saved report — without any real data fetching, LLM, or scoring. It is the first `Report` write in the system (per `architecture.md` / `progress-tracker.md`).

The placeholder report is scaffolding: Unit 13 replaces the worker's placeholder step with the real analysis pipeline. Everything here is built so that swap is a localized change.

Explicit non-goals for this unit (later units own these):

- No TwitterAPI.io / provider calls (Units 10, 16), no LLM (Units 11, 17), no scoring (Unit 14), no analysis pipeline (Unit 13), no website/docs ingestion (Unit 12).
- No `OrgProfile`/`KolProfile`/`EngagedAccountSample`/`ProviderUsageLog` rows, and no separate `ReportEvidence` row (evidence is embedded in the placeholder report JSON; a real `ReportEvidence` row arrives with real evidence in Units 13/15).
- No UI changes (the status page is Unit 09), no API route changes (Unit 06's route already enqueues).
- No pg-boss retry/reliability policy tuning (Unit 21).
- No commits.

## No Prisma Schema Change Required

The Unit 03 schema already supports everything here:

- `AnalysisJob` has `status`, `startedAt`, `completedAt`, `failedAt`, `errorCode`, `errorMessage`.
- `Report.requestId` is `@unique` (1:1 with the request) — this is exactly what makes duplicate-report prevention a simple `upsert` (see *Placeholder Report Behavior*).
- `Report` has `status`, `overallScore`, `verdict`, `scores`, `report`, `confidence`, `reportSchemaVersion`, `generatedAt`.

**Do not modify `packages/db/prisma/schema.prisma`.** If a genuine blocker appears that seems to require a schema change, stop and document it here first (none is anticipated).

## Worker Design

The worker is a **separate long-running Node process** (`apps/worker`), never imported by or run inside Next.js. It already exists as a stub (`console.log`). This unit turns it into a pg-boss consumer.

### Module layout (`apps/worker/src/`)

```
apps/worker/src/
  env.ts                    # loads the repo-root .env (side-effect); imported FIRST
  index.ts                  # boot: start boss, register work handler, graceful shutdown
  handlers/analysis-run.ts  # processAnalysisRun(job): validate -> load -> transition -> upsert report
  placeholder-report.ts     # buildPlaceholderReport(request): a valid, clearly-marked FitReport
```

### Environment loading (critical ordering)

Unlike the Next app, a standalone Node worker does **not** auto-load `.env`. The runtime Prisma client (`packages/db/src/client.ts`) reads `DATABASE_URL` at construction (first import), and pg-boss reads `DIRECT_URL` on start. So `env.ts` must run **before** `@kol-fit/db` / `@kol-fit/queue` are imported:

- `env.ts` calls `dotenv`'s `config({ path: path.resolve(process.cwd(), "../../.env") })` (both `pnpm --filter worker dev` and `start` run with cwd `apps/worker`, matching the existing `prisma.config.ts` pattern).
- `index.ts` imports `./env.js` on the very first line, before any `@kol-fit/*` import that reads env.

### Boot sequence (`index.ts`)

1. `import "./env.js";` (first).
2. `const boss = await getBoss();` — starts pg-boss on `DIRECT_URL` and ensures the `analysis.run` queue exists (both already handled inside `@kol-fit/queue`).
3. `await boss.work(QUEUE_NAMES.ANALYSIS_RUN, handler);` — register the consumer.
4. Log a clear "worker listening on analysis.run" line (keep the existing `APP_NAME` boot log).
5. **Graceful shutdown:** on `SIGINT`/`SIGTERM`, `await stopBoss()` then `await prisma.$disconnect()`, then `process.exit(0)`.
6. **Boot failure:** if `getBoss()`/`work()` reject (e.g. no reachable DB), log a clear one-line error and `process.exit(1)` — no unhandled rejection. Also attach `process.on("unhandledRejection")` / `"uncaughtException"` logging.

### Consumer connection

pg-boss uses the **direct** connection via `@kol-fit/queue` (`DIRECT_URL ?? DATABASE_URL`) — unchanged from Unit 06. Prisma uses `DATABASE_URL`. Both are loaded by `env.ts`.

## Job Processing Behavior

pg-boss 12 delivers jobs to the handler as a **batch array** (`Job<T>[]`), each `Job` = `{ id, name, data, signal, ... }` where `data` is the payload. The handler must iterate:

```
handler = async (jobs) => {
  for (const job of jobs) {
    await processAnalysisRun(job);   // isolate per-job errors (see Error Handling)
  }
};
```

`processAnalysisRun(job)` steps:

1. **Validate payload** with `AnalysisRunPayloadSchema` (from `@kol-fit/queue`). On failure: log a warning with `job.id`, and **ack** (return) — a malformed payload is not retryable. Do not throw.
2. **Load records:** `prisma.analysisJob.findUnique({ where: { id: payload.jobId }, include: { request: true } })`.
   - If the job (or its `request`) is **missing**: log a warning and ack/return — do not create anything, do not throw (handles deleted/stale jobs safely).
   - Sanity-check `job.requestId === payload.requestId`; on mismatch, log and ack/return.
3. **Idempotency short-circuit:** if `job.status === "COMPLETED"`, log "already completed, skipping" and return (a retry/redelivery must not reprocess or duplicate).
4. **Transition to RUNNING**, do the placeholder work, **upsert the report**, **transition to COMPLETED** — see the next two sections.

Default `work` options are fine (no concurrency/batch tuning this unit). The `for` loop + per-job isolation keeps a single bad job from sinking a batch.

## Status Transition Behavior

All transitions are Prisma updates on the loaded `AnalysisJob` (status enum values from the shared/Prisma enums), written so re-runs are idempotent:

- **QUEUED → RUNNING:** `update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: new Date() } })` before doing work. (If the job was already RUNNING from a crashed prior attempt, setting RUNNING again + refreshing `startedAt` is harmless.)
- **RUNNING → COMPLETED:** after the report upsert succeeds, `update({ data: { status: "COMPLETED", completedAt: new Date() } })`.
- **RUNNING → FAILED (on error):** in the per-job `catch`, `update({ data: { status: "FAILED", failedAt: new Date(), errorCode: "worker_error", errorMessage: <safe short message> } })`. Never store secrets/stack traces in `errorMessage` (Invariant 10) — use a short, sanitized string; full details go to `console.error` only.

The `Report.status` mirrors the outcome: the upsert sets `Report.status = "COMPLETED"` for the placeholder (a real failed pipeline would set `FAILED` later).

## Placeholder Report Behavior

- **Shape:** build a **valid `FitReport`** (shared `FitReportSchema`) via `buildPlaceholderReport(request)`, then `FitReportSchema.parse(...)` it before saving (Invariant 12 — validate structured report JSON before persistence). Store the parsed object in `Report.report`.
- **Clearly marked as placeholder** (so it can never be mistaken for a real report):
  - `overallScore = { value: 0, confidence: "low", reasons: ["Placeholder report — no analysis was performed."] }`
  - `verdict = "OKAY"` (neutral) with `confidence = "low"`
  - `evidence.notes = ["PLACEHOLDER report generated by the Unit 07 worker skeleton. No TwitterAPI.io, LLM, or scoring was run."]`, `evidence.sampleSizes = {}`
  - Optional narrative sections omitted (they are optional in the schema).
  - `schemaVersion = REPORT_SCHEMA_VERSION`.
- **Denormalized `Report` columns:** `status = "COMPLETED"`, `overallScore = 0`, `verdict = "OKAY"`, `scores = null` (no deterministic scoring yet), `confidence = null` (or `{ level: "low" }`), `reportSchemaVersion = REPORT_SCHEMA_VERSION`, `generatedAt = new Date()`, `llmModel = null`. `workspaceId = request.workspaceId` (null).
- **Duplicate prevention (idempotent upsert):** because `Report.requestId` is unique, use

  ```ts
  await prisma.report.upsert({
    where: { requestId },
    create: { requestId, workspaceId: request.workspaceId, status: "COMPLETED", ...fields },
    update: { status: "COMPLETED", generatedAt: new Date(), ...fields }, // no new row on retry
  });
  ```

  A retried or twice-delivered job reuses/refreshes the single report row instead of creating a duplicate. Combined with the `status === "COMPLETED"` short-circuit, reprocessing is safe.

`buildPlaceholderReport` lives in the worker (skeleton scaffolding); Unit 13 replaces the "build placeholder → upsert" step with the real pipeline's validated report.

## Error Handling

- **Per-job isolation:** `processAnalysisRun` wraps its work in try/catch. On any error after the records are loaded, it transitions the `AnalysisJob` to `FAILED` (as above) and returns **without rethrowing**, so pg-boss acks the job (no uncontrolled retry storm in the skeleton) and other jobs in the batch still process. Real pg-boss retry policy is a Unit 21 concern.
- **Missing/invalid records** (payload invalid, job/request not found, id mismatch): logged and ack'd, never thrown, no report created.
- **No secret/stack leakage:** `errorMessage` on the job is a short sanitized string; `console.error` carries full detail server-side only.
- **Boot/connection failure:** logged clearly and `process.exit(1)` (no unhandled rejection), so a misconfigured/unreachable DB fails fast and visibly.
- **Report validation failure:** if `FitReportSchema.parse` throws (should not for the fixed placeholder), it is caught by the per-job handler → job `FAILED`, no partial report saved.

## Implementation Steps

1. **Add dependencies to `apps/worker`:** `@kol-fit/db` (`workspace:*`), `@kol-fit/queue` (`workspace:*`), and `dotenv`. (`@kol-fit/shared`, `tsx`, `@types/node`, `typescript` already present.)
2. **`env.ts`** — load the repo-root `.env` via `dotenv` (`config({ path: path.resolve(process.cwd(), "../../.env") })`).
3. **`placeholder-report.ts`** — `buildPlaceholderReport(request)` returning a `FitReport` validated with `FitReportSchema`.
4. **`handlers/analysis-run.ts`** — `processAnalysisRun(job)` implementing validate → load → short-circuit → RUNNING → upsert report → COMPLETED, with the per-job try/catch → FAILED.
5. **`index.ts`** — `import "./env.js"` first; `getBoss()` → `boss.work(QUEUE_NAMES.ANALYSIS_RUN, handler)`; graceful shutdown + boot-failure handling; keep the `APP_NAME` boot log.
6. **Keep the worker standalone** — no imports from `apps/web`; nothing here runs in a Next route.
7. **Do not touch** `packages/db` (schema/generated), `packages/queue`, `packages/{twitter,llm,analysis,scoring}`, `apps/web`, or the UI.

## Dependencies

- New workspace deps on `apps/worker`: `@kol-fit/db`, `@kol-fit/queue`.
- New npm dep on `apps/worker`: `dotenv` (runtime env loading for the standalone process).
- Reused (no new install): `pg-boss` + `zod` come transitively via `@kol-fit/queue`; Prisma via `@kol-fit/db`.
- Explicitly **not** introduced: provider SDKs, OpenAI, Redis/BullMQ.

## Environment Variables Needed

No new variables. The worker uses the existing pair (already in `.env.example`):

- `DATABASE_URL` — Prisma runtime client (pooled).
- `DIRECT_URL` — pg-boss (direct/non-pooled), consumed by `@kol-fit/queue`.

The worker loads them from the repo-root `.env` via `env.ts` (it does not inherit Next's env loading).

## Verification Checklist

### Offline (no `DATABASE_URL`)

- [ ] `pnpm build` passes across all workspace projects (the worker compiles with the new imports).
- [ ] Running the worker with no reachable DB logs a clear connection error and exits non-zero (no unhandled rejection / no crash loop).

### Online (throwaway/local Postgres, schema applied via `prisma db push`)

Run web + worker against the same DB (set `DATABASE_URL` + `DIRECT_URL`), then:

- [ ] `POST /api/analyses` (valid body) → the worker picks up the job.
- [ ] `AnalysisJob` ends at `status = COMPLETED` with `startedAt` and `completedAt` set (observed transition QUEUED → RUNNING → COMPLETED).
- [ ] Exactly one `Report` row exists for that `requestId`, `status = COMPLETED`, `report` JSON **validates against `FitReportSchema`**, and is clearly marked placeholder (the `evidence.notes` placeholder string; `overallScore.value = 0`; `confidence = "low"`).
- [ ] **Idempotency:** enqueuing/processing the same request again (or re-delivering the job) does **not** create a second `Report` (still one row for the `requestId`) and does not error.
- [ ] **Missing records:** enqueue a payload with a non-existent `requestId`/`jobId` (e.g. via `enqueueAnalysisRun`) → the worker logs a warning, acks, creates no `Report`, and does not crash.
- [ ] **Failure path (optional):** a forced error during processing marks the `AnalysisJob` `FAILED` with `failedAt` + `errorCode = "worker_error"` and no secret in `errorMessage`.

### Scope guardrails

- [ ] `packages/db/prisma/schema.prisma` unchanged.
- [ ] No provider/LLM/scoring/pipeline/website-ingestion code; no UI change; no API route change.
- [ ] Worker code is confined to `apps/worker`; nothing runs inside Next.js routes.
- [ ] `context/progress-tracker.md` updated once implemented.
- [ ] No commits made.
```
