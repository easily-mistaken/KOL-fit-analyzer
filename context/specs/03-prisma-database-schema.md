# Unit 03: Prisma Database Schema

## Goal

Give `packages/db` a real Prisma setup against Supabase Postgres and define the **initial, lean-but-future-ready** relational schema for the product. At the end of this unit, the Prisma schema validates, the Prisma client generates and is exported from `@kol-fit/db`, and (when a live database is configured) an initial migration can be generated and applied. Nothing consumes the schema yet — API routes (Unit 05+), the queue (Unit 06), the worker (Unit 07), and the analysis pipeline (Unit 13) come later.

This unit implements the storage model from `architecture.md` (Storage Model, Suggested Database Models, Invariants 5/6/11/15/16) and the persistence decisions in `progress-tracker.md`.

Explicit non-goals for this unit (do not implement here):

- No pg-boss / queue logic (Unit 06). This schema models our *domain* job record (`AnalysisJob`), not pg-boss's internal tables.
- No worker or analysis pipeline logic (Units 07, 13).
- No API routes (Unit 05+).
- No TwitterAPI.io, LLM, or scoring logic (Units 10–11, 14, 16–17).
- No shared Zod schemas (Unit 04) — those mirror these models later, they are not created here.
- No UI changes except the minimum required for `pnpm build` to keep passing (expected: none).
- No commits.

## Design Constraints (carried from the request and context files)

- **Auth is out of scope but the schema is workspace-ready.** A `Workspace` model exists; `AnalysisRequest` and `Report` carry a **nullable** `workspaceId` from day one (architecture Invariant 16, build plan Unit 03). A single internal workspace is assumed; a `userId` can be added later without a breaking migration and is intentionally omitted now.
- **Reports persist from day one.** The `Report` model exists in this first schema; the first real write is the Unit 07 placeholder report.
- **Do not store unlimited raw provider payloads.** Only normalized entities, compact evidence JSON, sample-size metadata, scores, report JSON, status, errors, and cost/usage metadata are persisted (Invariant 15). No column is intended to hold raw Twitter/website payloads.
- **Keep deterministic scoring data separate from LLM narrative.** `Report.scores` (deterministic, from `packages/scoring`) is a distinct column from `Report.report` (LLM-generated structured narrative). Evidence lives in its own `ReportEvidence` row.
- **Enums for status.** `JobStatus`, `ReportStatus`, and `ReportVerdict` are Prisma enums.
- **JSON used deliberately** only where the shape will evolve (scores, report narrative, classifications, evidence, sample sizes, provider usage meta). Stable, queryable fields (handles, counts, status, verdict, timestamps) are real columns.
- **Indexes** for the common lookups: workspace/report history, job status, org handle, KOL handle, and `createdAt`.

## Reconciliation with `architecture.md`

`architecture.md` → *Suggested Database Models* lists `OrgSnapshot`, `KolSnapshot`, `EngagedAudienceSample`, `AudienceClassificationSummary`, `ScoreBreakdown`, `AnalysisReport`, `ProviderUsageLog` as a starting point ("at least"). This spec consolidates them into a leaner first schema and adopts the naming from the Unit 03 request:

| architecture.md suggestion | this schema |
| --- | --- |
| `OrgSnapshot` | `OrgProfile` |
| `KolSnapshot` | `KolProfile` |
| `AnalysisReport` | `Report` |
| `ScoreBreakdown` | `Report.scores` (JSON) + denormalized `Report.overallScore` / `Report.verdict` |
| `AudienceClassificationSummary` | `Report.audienceSummary` (JSON) / `ReportEvidence` |
| `EngagedAudienceSample` | `EngagedAccountSample` (optional, populated in Unit 13) |
| `AnalysisReport` evidence | `ReportEvidence` (compact evidence JSON, 1:1 with `Report`) |
| `ProviderUsageLog` | `ProviderUsageLog` |

**Action at implementation time (not now):** update `architecture.md` → *Suggested Database Models* to reference these concrete names so the docs and schema stay in sync (CLAUDE.md rule: update the relevant context file when the storage model changes). This is recorded as an open item in `progress-tracker.md`.

## Data Model Design

All ids are `cuid()`. All timestamps are `@db.Timestamptz`. `createdAt`/`updatedAt` on every mutable row.

### Enums

- `JobStatus` — `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED` (worker job lifecycle; Invariant 5).
- `ReportStatus` — `PENDING`, `COMPLETED`, `FAILED` (report artifact state, distinct from the job lifecycle).
- `ReportVerdict` — `STRONG`, `GOOD`, `OKAY`, `WEAK`, `AVOID` (denormalized for history/filtering in Unit 20; derived deterministically from the overall score).
- `EngagementSource` — `REPLY`, `QUOTE`, `RETWEET`, `FOLLOWER` (source of a sampled engaged account).

### Models

**Workspace** — workspace-ready placeholder; auth out of scope.
- `id`, `name`, `slug String @unique`, `createdAt`, `updatedAt`.
- Relations: `requests AnalysisRequest[]`, `reports Report[]`.
- A single default "internal" row is assumed to exist; `workspaceId` references are nullable so a null value means "the default internal workspace" until real workspaces exist.

**AnalysisRequest** — the user's submitted inputs (one per submitted analysis).
- `id`, `workspaceId String?` (nullable FK → `Workspace`).
- Required: `orgHandle String`, `kolHandle String`.
- Optional org context (columns, mirroring the Unit 08 form fields): `websiteUrl String?`, `docsUrl String?`, `productCategory String?`, `targetUser String?`, `campaignGoal String?`, `stage String?`, `region String?`.
- `createdAt`, `updatedAt`.
- Relations: `job AnalysisJob?` (1:1), `report Report?` (1:1), `orgProfile OrgProfile?` (1:1), `kolProfile KolProfile?` (1:1), `usageLogs ProviderUsageLog[]`.
- Indexes: `@@index([workspaceId, createdAt])`, `@@index([orgHandle])`, `@@index([kolHandle])`, `@@index([createdAt])`.

**AnalysisJob** — domain record of the background job lifecycle (Invariant 5, 11). Separate from pg-boss internal tables.
- `id`, `requestId String @unique` (FK → `AnalysisRequest`).
- `status JobStatus @default(QUEUED)`.
- `attempts Int @default(0)`.
- `pgBossJobId String?` (nullable link to the pg-boss job id; populated from Unit 06/07).
- Error context (no secrets, Invariant 10): `errorCode String?`, `errorMessage String?`.
- Timestamps: `createdAt`, `updatedAt`, `startedAt DateTime?`, `completedAt DateTime?`, `failedAt DateTime?`.
- Indexes: `@@index([status])`, `@@index([status, createdAt])`, `@@index([createdAt])`.

**OrgProfile** — normalized organization snapshot (no raw payloads, Invariant 15).
- `id`, `requestId String @unique` (FK → `AnalysisRequest`).
- `handle String`, plus a few normalized scalar columns: `displayName String?`, `bio String?`, `followersCount Int?`, `followingCount Int?`, `verified Boolean?`.
- `normalized Json?` — additional normalized provider-derived fields (evolving shape).
- `classification Json?` — LLM-inferred org positioning (category, target user, stage, campaign goal, region, keywords, per-field confidence). Kept as JSON because the shape evolves; manual brief fields on `AnalysisRequest` take priority (Invariant 7).
- `fetchedAt DateTime?`, `createdAt`, `updatedAt`.
- Indexes: `@@index([handle])`.

**KolProfile** — normalized KOL snapshot.
- `id`, `requestId String @unique` (FK → `AnalysisRequest`).
- `handle String`, `displayName String?`, `bio String?`, `followersCount Int?`, `followingCount Int?`, `postsAnalyzed Int?`.
- `normalized Json?` — normalized profile/post-summary fields.
- `contentClassification Json?` — LLM content analysis (themes, verticals, style, promo patterns, repeated tickers).
- `fetchedAt DateTime?`, `createdAt`, `updatedAt`.
- Indexes: `@@index([handle])`.

**Report** — the persisted final report; exists from day one, filled on completion.
- `id`, `requestId String @unique` (FK → `AnalysisRequest`), `workspaceId String?` (nullable FK → `Workspace`, denormalized for history queries).
- `status ReportStatus @default(PENDING)`.
- Deterministic scoring (from `packages/scoring`): `overallScore Int?` (denormalized for sorting/history), `verdict ReportVerdict?`, `scores Json?` (full deterministic breakdown + weights).
- LLM narrative (kept separate): `report Json?` (structured report with all 15 sections from Unit 15).
- `audienceSummary Json?` — audience-bucket distribution summary (fast render without per-account rows).
- `confidence Json?` — confidence level + per-field confidence impacts (Invariant 6).
- `sampleSize Json?` — top-level sample-size metadata (Invariant 6).
- Report/versioning metadata: `reportSchemaVersion Int?`, `llmModel String?`, `promptVersion String?` (code-standards: store model + report schema version).
- Failure context: `errorCode String?`, `errorMessage String?` (no secrets).
- `createdAt`, `updatedAt`, `generatedAt DateTime?`.
- Relations: `evidence ReportEvidence?` (1:1), `engagedSamples EngagedAccountSample[]`, `usageLogs ProviderUsageLog[]`.
- Indexes: `@@index([workspaceId, createdAt])` (history), `@@index([status])`, `@@index([verdict])`, `@@index([createdAt])`.

**ReportEvidence** — compact evidence JSON, separate from the report narrative and the hot `Report` row.
- `id`, `reportId String @unique` (FK → `Report`).
- `evidence Json` — compact evidence needed to explain the scores (Invariant 6, 15).
- `sampleSizes Json?` — detailed counts (posts analyzed, replies, quotes, retweeters, unique engaged accounts).
- `createdAt`, `updatedAt`.

**EngagedAccountSample** — *optional* normalized sampled engaged accounts (populated in Unit 13; empty until then). Enables future KOL intelligence without storing raw payloads. Per-report cap of 1,500 unique accounts is enforced in application logic (architecture Analysis Depth and Cost Controls), not by the schema.
- `id`, `reportId String` (FK → `Report`).
- `handle String?`, `accountId String?`, `source EngagementSource`, `bucket String?` (audience bucket classification), `signals Json?` (bot score, empty-bio flag, farming signals, etc.).
- `createdAt`.
- Indexes: `@@index([reportId])`, `@@index([bucket])`.

**ProviderUsageLog** — cost/usage metadata (build plan Unit 03; Invariant 11 debug context).
- `id`, `requestId String?` (nullable FK → `AnalysisRequest`), `reportId String?` (nullable FK → `Report`), `workspaceId String?`.
- `provider String` (e.g. `twitterapi.io`, `openai`), `operation String` (e.g. `getUserTweets`, `generateFitReport`).
- `requests Int?`, `tokensIn Int?`, `tokensOut Int?`, `costUsd Decimal? @db.Decimal(12, 6)`.
- `meta Json?`.
- `createdAt`.
- Indexes: `@@index([provider, createdAt])`, `@@index([requestId])`, `@@index([reportId])`.

### Target `schema.prisma` (adapt to the resolved Prisma version)

```prisma
generator client {
  provider = "prisma-client-js"
  // If the resolved Prisma version requires an explicit `output`, add it here
  // and re-export from that path in src/index.ts (see Implementation Steps).
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled (pgbouncer) connection
  directUrl = env("DIRECT_URL")     // direct connection for migrations
}

enum JobStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
}

enum ReportStatus {
  PENDING
  COMPLETED
  FAILED
}

enum ReportVerdict {
  STRONG
  GOOD
  OKAY
  WEAK
  AVOID
}

enum EngagementSource {
  REPLY
  QUOTE
  RETWEET
  FOLLOWER
}

model Workspace {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  requests AnalysisRequest[]
  reports  Report[]
}

model AnalysisRequest {
  id          String  @id @default(cuid())
  workspaceId String?

  orgHandle String
  kolHandle String

  websiteUrl      String?
  docsUrl         String?
  productCategory String?
  targetUser      String?
  campaignGoal    String?
  stage           String?
  region          String?

  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  workspace   Workspace?          @relation(fields: [workspaceId], references: [id])
  job         AnalysisJob?
  report      Report?
  orgProfile  OrgProfile?
  kolProfile  KolProfile?
  usageLogs   ProviderUsageLog[]

  @@index([workspaceId, createdAt])
  @@index([orgHandle])
  @@index([kolHandle])
  @@index([createdAt])
}

model AnalysisJob {
  id        String    @id @default(cuid())
  requestId String    @unique
  status    JobStatus @default(QUEUED)
  attempts  Int       @default(0)

  pgBossJobId  String?
  errorCode    String?
  errorMessage String?

  createdAt   DateTime  @default(now()) @db.Timestamptz
  updatedAt   DateTime  @updatedAt @db.Timestamptz
  startedAt   DateTime? @db.Timestamptz
  completedAt DateTime? @db.Timestamptz
  failedAt    DateTime? @db.Timestamptz

  request AnalysisRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([status, createdAt])
  @@index([createdAt])
}

model OrgProfile {
  id        String @id @default(cuid())
  requestId String @unique

  handle         String
  displayName    String?
  bio            String?
  followersCount Int?
  followingCount Int?
  verified       Boolean?

  normalized     Json?
  classification Json?

  fetchedAt DateTime? @db.Timestamptz
  createdAt DateTime  @default(now()) @db.Timestamptz
  updatedAt DateTime  @updatedAt @db.Timestamptz

  request AnalysisRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)

  @@index([handle])
}

model KolProfile {
  id        String @id @default(cuid())
  requestId String @unique

  handle         String
  displayName    String?
  bio            String?
  followersCount Int?
  followingCount Int?
  postsAnalyzed  Int?

  normalized            Json?
  contentClassification Json?

  fetchedAt DateTime? @db.Timestamptz
  createdAt DateTime  @default(now()) @db.Timestamptz
  updatedAt DateTime  @updatedAt @db.Timestamptz

  request AnalysisRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)

  @@index([handle])
}

model Report {
  id          String        @id @default(cuid())
  requestId   String        @unique
  workspaceId String?
  status      ReportStatus  @default(PENDING)

  overallScore Int?
  verdict      ReportVerdict?
  scores       Json?

  report          Json?
  audienceSummary Json?
  confidence      Json?
  sampleSize      Json?

  reportSchemaVersion Int?
  llmModel            String?
  promptVersion       String?

  errorCode    String?
  errorMessage String?

  createdAt   DateTime  @default(now()) @db.Timestamptz
  updatedAt   DateTime  @updatedAt @db.Timestamptz
  generatedAt DateTime? @db.Timestamptz

  request        AnalysisRequest        @relation(fields: [requestId], references: [id], onDelete: Cascade)
  workspace      Workspace?             @relation(fields: [workspaceId], references: [id])
  evidence       ReportEvidence?
  engagedSamples EngagedAccountSample[]
  usageLogs      ProviderUsageLog[]

  @@index([workspaceId, createdAt])
  @@index([status])
  @@index([verdict])
  @@index([createdAt])
}

model ReportEvidence {
  id       String @id @default(cuid())
  reportId String @unique

  evidence    Json
  sampleSizes Json?

  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  report Report @relation(fields: [reportId], references: [id], onDelete: Cascade)
}

model EngagedAccountSample {
  id       String           @id @default(cuid())
  reportId String
  handle    String?
  accountId String?
  source   EngagementSource
  bucket   String?
  signals  Json?

  createdAt DateTime @default(now()) @db.Timestamptz

  report Report @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@index([reportId])
  @@index([bucket])
}

model ProviderUsageLog {
  id          String  @id @default(cuid())
  requestId   String?
  reportId    String?
  workspaceId String?

  provider  String
  operation String
  requests  Int?
  tokensIn  Int?
  tokensOut Int?
  costUsd   Decimal? @db.Decimal(12, 6)
  meta      Json?

  createdAt DateTime @default(now()) @db.Timestamptz

  request AnalysisRequest? @relation(fields: [requestId], references: [id], onDelete: SetNull)
  report  Report?          @relation(fields: [reportId], references: [id], onDelete: SetNull)

  @@index([provider, createdAt])
  @@index([requestId])
  @@index([reportId])
}
```

## Implementation Steps

1. **Add dependencies to `packages/db`** (follow the Unit 01/02 pattern of adapting to whatever `latest` resolves to):
   - `pnpm --filter @kol-fit/db add -D prisma dotenv-cli`
   - `pnpm --filter @kol-fit/db add @prisma/client`
   - `dotenv-cli` is used so the Prisma CLI (run from `packages/db`) loads the **root** `.env`, where `DATABASE_URL`/`DIRECT_URL` live. (Alternative: a Prisma 6 `prisma.config.ts` that loads the root env — use whichever the resolved Prisma version supports cleanly.)

2. **Create `packages/db/prisma/schema.prisma`** with the target schema above. Run `prisma format` so it matches the resolved Prisma version's canonical formatting.

3. **Client generation + package build.** Update `packages/db/package.json` scripts so `pnpm build` regenerates the client before compiling:
   - `"generate": "prisma generate"`
   - `"build": "prisma generate && tsc -p tsconfig.json"`
   - `"db:migrate": "dotenv -e ../../.env -- prisma migrate dev"`
   - `"db:deploy": "dotenv -e ../../.env -- prisma migrate deploy"`
   - `"db:studio": "dotenv -e ../../.env -- prisma studio"`
   - `"db:validate": "prisma validate"`
   - Default generator output (import from `@prisma/client`) is preferred. **If** the resolved Prisma version requires an explicit `output`, set one inside the package (e.g. `../src/generated/prisma`, gitignored) and re-export the client/types from that path in `src/index.ts` — mirror the exact requirement the CLI reports, as Units 01–02 adapted to their toolchain.

4. **Prisma client singleton** at `packages/db/src/client.ts` using the standard global-caching pattern (prevents connection storms during dev/hot-reload):
   ```ts
   import { PrismaClient } from "@prisma/client";
   const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
   export const prisma = globalForPrisma.prisma ?? new PrismaClient();
   if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
   ```

5. **DB package exports** from `packages/db/src/index.ts`:
   - `export { prisma } from "./client";`
   - Re-export the generated `Prisma` namespace, model types, and enums (`JobStatus`, `ReportStatus`, `ReportVerdict`, `EngagementSource`) from `@prisma/client` so consumers import DB types via `@kol-fit/db`, not directly from `@prisma/client`.
   - Keep the existing `PACKAGE_NAME` export or remove it — it was a scaffold placeholder; removing it is fine as long as nothing imports it (nothing does).

6. **Gitignore generated artifacts.** Ensure `.gitignore` covers any custom generated client path if used (the root `.gitignore` already ignores `node_modules/` and `dist/`; add the custom Prisma output dir only if step 3's fallback path is taken). Do **not** ignore `packages/db/prisma/migrations/` — migration history is meant to be tracked (no commits are made this unit, but the files should exist and be trackable).

7. **tsconfig check.** `packages/db/tsconfig.json` currently compiles `src` → `dist`. Confirm it still builds with the new imports. If a custom generated-client output under `src/` is used, ensure it is included; if the default `@prisma/client` output is used (recommended), no tsconfig change is needed.

8. **Do not touch:** `apps/web/*` (beyond nothing), `apps/worker/*`, `packages/{twitter,llm,analysis,scoring,shared}`, and create no `apps/web/app/api/*`.

## Dependencies Introduced

- `prisma` (dev, in `packages/db`)
- `@prisma/client` (runtime, in `packages/db`)
- `dotenv-cli` (dev, in `packages/db`) — to load the root `.env` for Prisma CLI commands

Explicitly **not** introduced: `pg-boss`, `zod`, OpenAI/TwitterAPI.io clients, any web/worker dependency.

## Environment Variables Needed

No new variables. The two required were added to `.env.example` in Unit 01 (marked "added in Unit 03"):

- `DATABASE_URL` — Supabase **pooled** connection string (PgBouncer, typically port `6543`, `?pgbouncer=true`). Used by the runtime client.
- `DIRECT_URL` — Supabase **direct** connection string (typically port `5432`). Used by `prisma migrate` (migrations require a direct, non-pooled connection and a shadow database).

`.env` (with real Supabase credentials) is never committed (Invariant 10; `.gitignore` already excludes it). If the spec's field comments need clarification of pooled-vs-direct usage, that is a one-line `.env.example` comment update only.

## Prisma Migration / Dev Workflow

- **Author/change schema:** edit `packages/db/prisma/schema.prisma`, then `pnpm --filter @kol-fit/db exec prisma format` and `... prisma validate`.
- **Generate client (no DB needed):** `pnpm --filter @kol-fit/db generate` (also runs as part of `pnpm build`).
- **Create + apply the initial migration (requires a live DB):** `pnpm --filter @kol-fit/db db:migrate --name init`. This writes `packages/db/prisma/migrations/<timestamp>_init/` and applies it via `DIRECT_URL`.
- **Apply in non-dev (later/CI):** `pnpm --filter @kol-fit/db db:deploy`.
- **Quick prototyping alternative (no migration history):** `prisma db push` — acceptable for throwaway local sync, but `migrate dev` is the source of truth for schema history.
- **Inspect:** `pnpm --filter @kol-fit/db db:studio`.

**No-live-database fallback (matches this environment):** if no Supabase `DATABASE_URL`/`DIRECT_URL` is configured, `prisma validate` + `prisma generate` + `pnpm build` still fully verify the schema and client offline. `migrate dev`/connection tests are deferred until credentials exist, and that deferral is recorded in `progress-tracker.md` rather than blocking the unit.

## Verification Checklist

Offline (always runnable):

- [ ] `pnpm --filter @kol-fit/db exec prisma validate` passes.
- [ ] `pnpm --filter @kol-fit/db exec prisma format` leaves the schema unchanged (already canonical).
- [ ] `pnpm --filter @kol-fit/db generate` succeeds and generates the client.
- [ ] `pnpm build` passes across all 8 packages/apps (the `@kol-fit/db` build runs `prisma generate` then `tsc`).
- [ ] `@kol-fit/db` exports `prisma` and the generated enums/types (a small type-only import in a scratch file, or `tsc` on the package, confirms it compiles).
- [ ] Schema contains the `JobStatus`, `ReportStatus`, `ReportVerdict`, `EngagementSource` enums.
- [ ] `AnalysisRequest.workspaceId` and `Report.workspaceId` are nullable.
- [ ] Indexes exist for: `workspaceId + createdAt` (history), `AnalysisJob.status`, `orgHandle`, `kolHandle`, and `createdAt`.
- [ ] Deterministic `Report.scores` is a separate column from the LLM `Report.report`; evidence is in `ReportEvidence`.
- [ ] No raw-payload column exists on any model.

Online (only when a live Supabase database is configured):

- [ ] `pnpm --filter @kol-fit/db db:migrate --name init` creates and applies the initial migration.
- [ ] `prisma migrate status` reports the schema in sync.
- [ ] A minimal connection smoke test (`prisma.$connect()` in a throwaway script, or `prisma db execute`) succeeds against Supabase.

Scope guardrails:

- [ ] No pg-boss/queue, worker, analysis, provider, LLM, or scoring logic added.
- [ ] No `apps/web/app/api/*` created; no UI changes beyond build compatibility (expected: none).
- [ ] `apps/worker` and `packages/{twitter,llm,analysis,scoring,shared}` untouched.
- [ ] `context/progress-tracker.md` updated to reflect Unit 03 status; the `architecture.md` model-name reconciliation recorded as an open item.
- [ ] No commits made.
```
