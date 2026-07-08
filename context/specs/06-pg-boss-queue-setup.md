# Unit 06: pg-boss Queue Setup

## Goal

Introduce Postgres-backed background-job infrastructure with pg-boss, and make `POST /api/analyses` actually enqueue work. After creating the `AnalysisRequest` + `AnalysisJob` (QUEUED), the route enqueues an `analysis.run` pg-boss job and stores the returned pg-boss job id on `AnalysisJob.pgBossJobId`. No job is *consumed* yet — the worker processor is Unit 07. This wires the "API enqueues pg-boss job" step of the `architecture.md` data flow.

Explicit non-goals for this unit (later units own these):

- **No worker processor / `boss.work(...)` handler** (Unit 07). This unit only *produces* jobs.
- **No placeholder report generation** (Unit 07), no `Report`/profile/evidence rows.
- No TwitterAPI.io, LLM, scoring, or analysis-pipeline logic.
- No UI changes.
- No Redis/BullMQ (architecture defers that until pg-boss is a bottleneck).
- No commits.

## No Prisma Schema Change Required

`AnalysisJob.pgBossJobId String?` already exists (Unit 03), so storing the pg-boss job id needs **no** Prisma schema change. **Do not modify `packages/db/prisma/schema.prisma`.** (pg-boss creates its *own* tables in a separate `pgboss` schema — see *Database / pg-boss Setup Behavior* — which is not a Prisma-managed change.) If a genuine blocker appears that seems to require a schema change, stop and document it here first (none is anticipated).

## Queue Design

### Where the code lives — new `packages/queue` package

pg-boss is a distinct bounded concern (a job queue with a documented future swap to Redis/BullMQ), and it is needed by **both** `apps/web` (enqueue, this unit) and `apps/worker` (consume, Unit 07). It should therefore be an isolated workspace package rather than inline route code or a submodule of `packages/db` (which owns Prisma/ORM):

- Satisfies "keep pg-boss code isolated from route-handler business logic" — the route calls one helper; all pg-boss specifics live behind the package boundary.
- Matches `code-standards.md` ("add abstractions only when they protect a real system boundary") — the queue is such a boundary; a future BullMQ swap becomes a package-internal change.
- `packages/db` stays purely ORM/schema; `packages/queue` owns queue infra. Both share the same Postgres database but are separate concerns.

**Architecture doc impact:** this adds `packages/queue` to the repo structure. `architecture.md` (Repository Structure + System Boundaries) currently does not list it; update those to include `packages/queue` (owns pg-boss setup, enqueue helpers, job-name constants, and job-payload schemas) as part of implementing this unit. Recorded as an open item in `progress-tracker.md`.

### Package shape — `@kol-fit/queue`

```
packages/queue/
  package.json        # name @kol-fit/queue; deps: pg-boss, zod
  tsconfig.json       # extends ../../tsconfig.base.json (Node16, src -> dist)
  src/
    index.ts          # barrel
    constants.ts      # QUEUE_NAMES
    payloads.ts       # AnalysisRunPayloadSchema + type
    boss.ts           # pg-boss singleton lifecycle (getBoss/stopBoss)
    enqueue.ts        # enqueueAnalysisRun()
```

### Connection — use the DIRECT (non-pooled) URL

pg-boss relies on session-level features (LISTEN/NOTIFY, advisory locks, maintenance) that are **incompatible with PgBouncer transaction pooling**. It must connect via the **direct** connection: `process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? ""`. (Prisma's runtime client keeps using the pooled `DATABASE_URL` — the two coexist.) No new environment variable is required; an optional dedicated `QUEUE_DATABASE_URL` override can be added later if needed, but is out of scope here.

### Lazy, cached singleton (never connects at import)

- `getBoss()` lazily constructs `new PgBoss(connectionString)`, calls `boss.start()` **once**, ensures the `analysis.run` queue exists (`boss.createQueue(...)`), and caches the started instance (a memoized `Promise<PgBoss>` on `globalThis`, like the Prisma singleton) so hot-reload/concurrent requests don't spawn multiple bosses or double-start.
- **Construction and `start()` must not run at module import time** — only inside `getBoss()` on first enqueue. This keeps `next build` (which imports the route module) from connecting, and preserves the offline-safe behavior.
- `stopBoss()` gracefully stops the instance (used by the worker/tests later); the long-lived web server process normally keeps the boss running.
- Adapt to the resolved **pg-boss 12.25.1** API exactly (v10+ requires explicit `createQueue` before `send`; `send()` returns the job id string or null). If the resolved API differs from a sketch here, follow the installed version — consistent with how prior units adapted to their toolchains.

## Job Naming / Constants

`packages/queue/src/constants.ts`:

```ts
export const QUEUE_NAMES = {
  ANALYSIS_RUN: "analysis.run",
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
```

`analysis.run` matches `architecture.md` → Background Job Model. Future job names (`analysis.retry`, `report.export`, `provider.refresh-profile`) are **not** added yet.

`packages/queue/src/payloads.ts` — the `analysis.run` payload, validated on the consume side in Unit 07 (Invariant 9):

```ts
import { z } from "zod";
export const AnalysisRunPayloadSchema = z.object({
  requestId: z.string(), // AnalysisRequest.id (canonical id)
  jobId: z.string(),     // AnalysisJob.id (so the worker can update the exact row)
});
export type AnalysisRunPayload = z.infer<typeof AnalysisRunPayloadSchema>;
```

## Database / pg-boss Setup Behavior

- **pg-boss owns its tables.** On the first `boss.start()`, pg-boss creates its own schema (default `pgboss`) and tables (`pgboss.job`, `pgboss.queue`, archive, etc.) in the **same Postgres database** as the app. This is separate from Prisma's `public` schema; Prisma neither manages nor sees these tables, and they are **not** part of `prisma migrate`.
- **Local/dev initialization:** no manual step — pg-boss auto-creates its schema/tables lazily the first time the queue is used (the first `POST /api/analyses`, or the worker's start in Unit 07). The database role must have privileges to create a schema (Supabase's default role and a local superuser both do). For the throwaway local Postgres used in verification, `boss.start()` creates everything automatically.
- Optionally the schema name can be pinned via pg-boss options (`{ schema: "pgboss" }`); the default is fine for this unit.

## API Integration Behavior

Update `apps/web/app/api/analyses/route.ts`. The happy path becomes: **validate → create records → enqueue → store pgBossJobId → 201**. The route stays thin: all pg-boss specifics are behind `enqueueAnalysisRun(...)` from `@kol-fit/queue`; the route adds exactly one enqueue call and one best-effort `prisma.analysisJob.update`.

Sequence after the existing nested create succeeds:

1. `const bossJobId = await enqueueAnalysisRun({ requestId: created.id, jobId: created.job.id })`.
2. `await prisma.analysisJob.update({ where: { id: created.job.id }, data: { pgBossJobId: bossJobId } })` (best-effort).
3. Return `201 ok({ id, jobId, status: "QUEUED", createdAt })` — response shape unchanged from Unit 05 (pgBossJobId is internal; not exposed to the client).

Isolation/runtime constraints:

- Only import `@kol-fit/queue` from **server-side** code (this route handler, `runtime = "nodejs"`; the Unit 07 worker). **Never** from client components — pg-boss is Node-only. The lazy singleton guarantees no connection during the client/build graph.

## Error Handling

Building on Unit 05's matrix; all responses use the shared `ok()`/`err()` helpers, and no DB/driver/pg-boss error text, stack trace, or secret is ever returned (Invariant 10).

| Case | HTTP | `error.code` | Behavior |
| --- | ---: | --- | --- |
| Malformed JSON / schema invalid | 400 | `validation_error` | unchanged from Unit 05 |
| Records create fails (e.g. no DB) | 500 | `internal_error` | unchanged; enqueue never reached (offline-safe) |
| **Enqueue fails** (boss/`send` throws or returns null) | 500 | `internal_error` | best-effort mark the just-created `AnalysisJob` as `FAILED` with `errorCode = "enqueue_failed"` (+ `failedAt`) so it is not a silent orphaned QUEUED job (Invariant 11); then 500. If that update also fails, still return 500. |
| Enqueue succeeds, `pgBossJobId` update fails | 201 | — | the job **is** enqueued and will be processed; the id is only a debugging link, so log server-side and still return 201. |
| All succeed | 201 | — | `pgBossJobId` stored |

- `console.error` for server-side diagnostics; generic client messages only.
- No reconciliation/retry sweep of orphaned jobs here (that's a Unit 21 reliability concern); the `FAILED` + `errorCode` safeguard above is the minimal debuggable behavior for now.

## Implementation Steps

1. **Create `packages/queue`** with `package.json` (`@kol-fit/queue`, private, `main`/`types` -> `dist`, build script `tsc -p tsconfig.json`) and `tsconfig.json` extending the base (Node16, `src` -> `dist`). Add deps `pg-boss` and `zod`.
2. **`constants.ts`** — `QUEUE_NAMES` + `QueueName` type.
3. **`payloads.ts`** — `AnalysisRunPayloadSchema` + `AnalysisRunPayload`.
4. **`boss.ts`** — lazy cached `getBoss()` (construct → `start()` → `createQueue(ANALYSIS_RUN)` once, memoized on `globalThis`) reading `DIRECT_URL ?? DATABASE_URL`; `stopBoss()`. No connection at import.
5. **`enqueue.ts`** — `enqueueAnalysisRun(payload: AnalysisRunPayload): Promise<string>` → validates payload, `const boss = await getBoss(); const id = await boss.send(QUEUE_NAMES.ANALYSIS_RUN, payload); if (!id) throw new Error("enqueue returned no job id"); return id;`.
6. **`index.ts`** — barrel export of constants, payloads, `enqueueAnalysisRun`, `getBoss`, `stopBoss`.
7. **Add `@kol-fit/queue` to `apps/web`** (`workspace:*`); `pnpm install`.
8. **Update the route** per *API Integration Behavior* — enqueue + store `pgBossJobId` + the `enqueue_failed` safeguard. Keep it thin.
9. **Next bundling (build-compat):** if `next build` complains about bundling `pg-boss`/`pg`, add them (with the existing Prisma packages) to `serverExternalPackages` in `apps/web/next.config.mjs`. Apply only if needed.
10. **Do not touch** `packages/db` (schema/generated), `apps/worker` (Unit 07), `packages/{twitter,llm,analysis,scoring,shared}`, or the UI.

## Dependencies

- `pg-boss` (in `packages/queue`; resolves to 12.x — adapt to the installed API).
- `zod` (in `packages/queue`, for payload validation).
- New workspace dependency: `apps/web` gains `@kol-fit/queue` (`workspace:*`). (`@kol-fit/db` already present from Unit 05.)
- Possible build-compat: `serverExternalPackages` entry in `apps/web/next.config.mjs` (only if the build needs it).
- Explicitly **not** introduced: Redis/BullMQ, any provider SDK.

## Environment Variables

- **No new variable required.** pg-boss reuses the existing `DIRECT_URL` (falling back to `DATABASE_URL`) — the direct, non-pooled connection, for the reason in *Queue Design → Connection*. `.env.example` needs no change. (An optional `QUEUE_DATABASE_URL` override is deferred.)

## Verification Checklist

### Offline (always runnable; no `DATABASE_URL`)

- [ ] `pnpm build` passes across all packages/apps — the new `packages/queue` builds; `apps/web` builds with the queue import; importing the queue does **not** connect at build time (no hang/failure).
- [ ] Dev server: invalid body → 400 `validation_error`; malformed JSON → 400 (unchanged from Unit 05).
- [ ] Dev server with no reachable DB: a valid body still returns a clean **500 `internal_error`** (records create fails before enqueue; no crash, no leak).

### Online (throwaway/local Postgres with the app schema applied via `prisma db push`)

- [ ] First valid `POST /api/analyses` returns **201** `{ ok: true, data: { id, jobId, status: "QUEUED", createdAt } }`.
- [ ] pg-boss auto-created its `pgboss` schema/tables on first use (verify the `pgboss` schema exists).
- [ ] A pg-boss job row exists for queue `analysis.run` with payload `{ requestId, jobId }` matching the created records.
- [ ] `AnalysisJob.pgBossJobId` is now **non-null** and equals the enqueued pg-boss job id; `status` is still `QUEUED` (no worker consumes it yet).
- [ ] No `Report`/`OrgProfile`/`KolProfile` rows were created.

### Scope guardrails

- [ ] `packages/db/prisma/schema.prisma` unchanged.
- [ ] No `boss.work(...)`/worker processor, no report generation, no provider/LLM/scoring/pipeline code, no UI change.
- [ ] pg-boss code is confined to `packages/queue`; the route only calls `enqueueAnalysisRun` + one `pgBossJobId` update.
- [ ] `context/progress-tracker.md` updated; the `architecture.md` `packages/queue` doc-sync recorded.
- [ ] No commits made.
```
