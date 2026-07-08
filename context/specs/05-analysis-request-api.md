# Unit 05: Analysis Request API

## Goal

Add the first API route: a thin `POST` handler that accepts an analysis request, validates it with the shared Zod schema, persists an `AnalysisRequest` plus its `AnalysisJob` (status `QUEUED`) via Prisma, and returns a predictable response using the shared `ApiResponse` shape. This is the entry point of the data flow in `architecture.md` ("Next.js API validates input → creates AnalysisRequest + AnalysisJob → …").

The route does the minimum a request-creation endpoint should: validate, write two rows, return an id and status. It does **not** enqueue anything, run analysis, or create a report.

Explicit non-goals for this unit (later units own these):

- **No pg-boss enqueue** (Unit 06 adds queueing and updates this route to enqueue after the DB write). The job is created in `QUEUED` state but nothing consumes it yet; `pgBossJobId` stays null.
- **No worker logic** (Unit 07).
- **No `Report` row and no placeholder report generation** (Unit 07 is the first report save, per `architecture.md` + `progress-tracker.md`). See *Database Write Behavior* for why Unit 05 deliberately does not create a `Report`.
- **No `OrgProfile`/`KolProfile`/evidence/sample rows** — those are written by the pipeline (Units 13+).
- No TwitterAPI.io, LLM, scoring, or analysis-pipeline logic.
- No `GET`/status route (Unit 09) and no analysis form UI (Unit 08).
- No major UI changes.
- No commits.

## No Schema Changes Required

The Unit 03 schema already supports this unit end to end: `AnalysisRequest` has the columns 1:1 with the shared input, `AnalysisJob` is 1:1 with the request via a unique `requestId` and defaults `status` to `QUEUED`. **This unit must not modify `packages/db/prisma/schema.prisma`.** If, during implementation, a genuine blocker surfaces that seems to require a schema change, stop and document the reason here before touching the schema (none is anticipated).

## API Design

- **Route:** `POST /api/analyses` — creates one analysis (request + queued job).
- **File:** `apps/web/app/api/analyses/route.ts` (Next.js App Router route handler; export an async `POST(req: Request)`).
- **Runtime:** Node.js — `export const runtime = "nodejs"` (Prisma + the `pg` driver adapter require the Node runtime, not Edge). POST handlers are dynamic by default.
- **Thin handler (Invariant 1 / `code-standards.md` → Next.js):** the route validates input, writes lightweight records, and returns. No long-running work, no provider calls, no scoring.
- **Resource shape going forward:** the created analysis is addressed by the `AnalysisRequest.id`. Unit 09 will add `GET /api/analyses/[id]` for status/report polling; this unit only adds `POST`. Other HTTP methods on the route fall through to Next's automatic 405.

Keep the handler small. A tiny local helper to flatten Zod issues into a message may live inline in the route or in `apps/web/lib/` — do not over-engineer.

## Request / Response Shape

### Request

`Content-Type: application/json`. Body is the shared `AnalysisRequestInput`:

```jsonc
{
  "orgHandle": "myorg",           // required
  "kolHandle": "somekol",         // required
  "websiteUrl": "https://...",    // optional, valid URL
  "docsUrl": "https://...",       // optional, valid URL
  "productCategory": "...",       // optional, 1–120 chars
  "targetUser": "...",            // optional, 1–280 chars
  "campaignGoal": "...",          // optional, 1–120 chars
  "stage": "...",                 // optional, 1–120 chars
  "region": "..."                 // optional, 1–120 chars
}
```

Handles are normalized by the schema (`@MyOrg` → `myorg`). `workspaceId` is **not** accepted from the client (auth out of scope; set server-side — here, left null).

### Success response — HTTP 201

Body is `ApiResponse<AnalysisCreated>` from `@kol-fit/shared`:

```jsonc
{
  "ok": true,
  "data": {
    "id": "clx…",          // AnalysisRequest.id — the canonical id used to poll status/report later
    "jobId": "cly…",       // AnalysisJob.id
    "status": "QUEUED",    // JobStatus
    "createdAt": "2026-07-08T12:34:56.000Z"
  }
}
```

The `data` payload type is defined locally in the route (typed as `ApiResponse<{ id: string; jobId: string; status: JobStatus; createdAt: string }>`, reusing `JobStatus` from `@kol-fit/shared`). A shared `AnalysisCreated` type can be promoted into `packages/shared` when Unit 08/09 needs it on the client; not required now.

### Error response — HTTP 400 / 500

Body is `ApiResponse<never>` via the shared `err()` helper:

```jsonc
{ "ok": false, "error": { "code": "validation_error", "message": "orgHandle: … ; websiteUrl: …" } }
```

The client should branch on the `ok` boolean; HTTP status mirrors the error category.

## Validation Rules

1. **Body must be valid JSON.** If `req.json()` throws, return 400 `validation_error` with message "Invalid JSON body".
2. **Body must satisfy `AnalysisRequestInputSchema`** (`safeParse`). On failure, return 400 `validation_error` with a concise message built by flattening the Zod issues (e.g. `"orgHandle: Handle must be a valid Twitter/X username; websiteUrl: Invalid URL"`). Do not dump the raw Zod error object.
3. **Use the parsed/normalized output** (`result.data`) for the DB write — never the raw body — so stored handles are normalized and unknown fields are stripped (Zod object strips unknown keys by default).
4. No cross-field product rules are invented here (e.g. org == kol is **not** rejected — it isn't defined as invalid in the product docs; recorded as an open question rather than guessed).

## Database Write Behavior

- **Single atomic nested create** via the shared `prisma` client (`@kol-fit/db`):

  ```ts
  const created = await prisma.analysisRequest.create({
    data: {
      orgHandle: input.orgHandle,
      kolHandle: input.kolHandle,
      websiteUrl: input.websiteUrl ?? null,
      docsUrl: input.docsUrl ?? null,
      productCategory: input.productCategory ?? null,
      targetUser: input.targetUser ?? null,
      campaignGoal: input.campaignGoal ?? null,
      stage: input.stage ?? null,
      region: input.region ?? null,
      // workspaceId omitted -> null (single internal workspace; null = default)
      job: { create: {} }, // AnalysisJob.status defaults to QUEUED
    },
    include: { job: true },
  });
  ```

  Prisma runs the parent + nested child insert in one implicit transaction, so a request never exists without its job.
- **`AnalysisJob`** is created with the schema default `status = QUEUED` and `attempts = 0`; timestamps default. `pgBossJobId`/`errorCode`/`errorMessage` stay null.
- **No `Report` row is created.** Rationale: the build plan scopes Unit 05 to `AnalysisRequest` + `AnalysisJob` only, and `architecture.md`/`progress-tracker.md` fix the first report write at Unit 07 (placeholder) with `Report` being 1:1 on `requestId`. The returned `id` (requestId) is the stable key the future `Report` and the Unit 09 status route will use, so nothing is lost by deferring the row. Creating a `PENDING` report now would be "placeholder report" work this unit explicitly excludes.
- **`workspaceId` is null.** No `Workspace` seed row is needed (null denotes the default internal workspace, per `architecture.md`). Seeding a real default workspace is deferred until auth/workspaces exist.

## Error Handling

| Case | HTTP | `error.code` | Notes |
| --- | ---: | --- | --- |
| Malformed JSON body | 400 | `validation_error` | message: "Invalid JSON body" |
| Schema validation fails | 400 | `validation_error` | flattened field messages; no raw Zod dump |
| DB write / unexpected error | 500 | `internal_error` | catch-all; **never** leak the DB/driver error text, stack traces, or secrets (Invariants 10). Log server-side with `console.error`; return a generic message. |
| Wrong HTTP method | 405 | — | Next's automatic handling (only `POST` exported) |

- All responses go through the shared `ok()` / `err()` helpers so the shape is consistent.
- Provider-specific errors do not exist in this route; any thrown error maps to `internal_error`.
- A missing/empty `DATABASE_URL` (no reachable DB) surfaces as a thrown Prisma error inside the try/catch → a clean 500 `internal_error`, not a crash (this is the offline-safe behavior exercised in verification).

## Implementation Steps

1. **Add the DB package to the web app:** add `"@kol-fit/db": "workspace:*"` to `apps/web/package.json` dependencies and run `pnpm install`. (`@kol-fit/shared` is already a dependency.)
2. **Next bundling for Prisma/pg (build-compat):** if `next build` or runtime complains about bundling the Prisma client or `pg`, add `serverExternalPackages: ["@kol-fit/db", "@prisma/client", "@prisma/adapter-pg", "pg"]` to `apps/web/next.config.mjs` so they stay external Node modules on the server. Apply only if needed; keep the change minimal.
3. **Create `apps/web/app/api/analyses/route.ts`:**
   - `export const runtime = "nodejs";`
   - `export async function POST(req: Request)`.
   - Parse JSON in a try/catch → 400 on failure.
   - `AnalysisRequestInputSchema.safeParse(body)` → 400 with flattened message on failure.
   - `prisma.analysisRequest.create({ … job: { create: {} } , include: { job: true } })` inside a try/catch → 500 on failure.
   - Return `NextResponse.json(ok({ id, jobId, status, createdAt }), { status: 201 })` (or `Response.json`), and `err(...)` with the mapped status otherwise.
   - Import `prisma` from `@kol-fit/db`; `AnalysisRequestInputSchema`, `ok`, `err`, and `JobStatus` from `@kol-fit/shared`.
4. **Keep it thin** — no enqueue, no report, no provider/scoring/pipeline imports.
5. **Do not touch** `packages/db` (schema/generated), `apps/worker`, `packages/{twitter,llm,analysis,scoring}`, or `packages/shared` source. No other routes.

## Dependencies

- **No new npm packages.** `zod`, `@prisma/client`, `@prisma/adapter-pg`, `pg` already exist in the workspace; `@kol-fit/shared` is already a web dependency.
- **New workspace dependency:** `apps/web` gains `@kol-fit/db` (`workspace:*`).
- Possible **build-compat config**: `serverExternalPackages` in `apps/web/next.config.mjs` (only if the build needs it).
- Explicitly **not** introduced: `pg-boss` (Unit 06), any provider SDK.

## Verification Checklist

### Offline (always runnable; no `DATABASE_URL` needed)

- [ ] `pnpm build` passes across all 8 packages/apps (the new route type-checks; `@kol-fit/db` import resolves in the web build).
- [ ] Start `pnpm --filter web dev`. `POST /api/analyses` with an **invalid** body (e.g. `{ "orgHandle": "bad handle!", "kolHandle": "" }`) returns **HTTP 400** and `{ ok: false, error: { code: "validation_error", … } }`. This exercises the route + shared schema + error shape without a database.
- [ ] `POST /api/analyses` with **malformed JSON** returns HTTP 400 `validation_error` ("Invalid JSON body").
- [ ] With no reachable DB, a **valid** body returns a clean **HTTP 500** `{ ok: false, error: { code: "internal_error", … } }` (graceful failure, no crash, no stack trace / secret in the body). Confirms the DB write is correctly guarded.
- [ ] A wrong method (e.g. `GET /api/analyses`) returns 405 (Next default).

### Online (only when a database is configured)

Requires a reachable Postgres with the schema applied. Since no migration has been generated yet (Unit 03 open item), first materialize tables against the target DB: `pnpm --filter @kol-fit/db exec prisma migrate dev --name init` (or `prisma db push` for a throwaway/local DB). Then:

- [ ] `POST /api/analyses` with a valid body returns **HTTP 201** and `{ ok: true, data: { id, jobId, status: "QUEUED", createdAt } }`.
- [ ] The DB now has one `AnalysisRequest` (with normalized handles, optional context stored, `workspaceId` null) and one `AnalysisJob` (`status = QUEUED`, `attempts = 0`, `pgBossJobId` null) linked by `requestId` — verify via a quick `prisma` query or `prisma studio`.
- [ ] **No** `Report`, `OrgProfile`, `KolProfile`, or evidence rows were created.

### Scope guardrails

- [ ] `packages/db/prisma/schema.prisma` is unchanged.
- [ ] No pg-boss / queue code, no worker changes, no provider/LLM/scoring/pipeline code, no report generation.
- [ ] Only `apps/web` changed (new route, `package.json` dep, optional `next.config.mjs`); `pnpm-lock.yaml` updated.
- [ ] `context/progress-tracker.md` updated once implemented.
- [ ] No commits made.
```
