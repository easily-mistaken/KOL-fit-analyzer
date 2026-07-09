# Unit 09: Report Status Page

## Goal

Replace the temporary `/analyses/[id]` placeholder (Unit 08) with a real status page that reflects the saved database state of an analysis: it shows queued / running / completed / failed / not-found, polls while the job is in flight, stops when it reaches a terminal state, and renders the placeholder `Report` (from Unit 07) once completed. A new thin, read-only `GET /api/analyses/[id]` endpoint is the single source of status/report data; the DB is the source of truth and nothing is recalculated on the client.

This closes the user-visible loop: submit form → redirect → watch it run → see the (placeholder) report.

Explicit non-goals for this unit (later units own these):

- **No full 15-section report renderer** (Unit 15). Completed state shows only a compact card built from the few saved placeholder fields.
- No scoring UI beyond echoing existing saved report fields; no client-side computation.
- No TwitterAPI.io, LLM, or real analysis-pipeline logic.
- No worker changes (the worker already writes all the status/report state this page reads) and no Prisma schema changes (all needed fields exist).
- No auth, no saved-reports list (Unit 20), no share links / export.
- No commits.

## No Schema / Worker Change Required

The Unit 03 schema already exposes everything the page needs: `AnalysisJob.{status,startedAt,completedAt,failedAt,errorCode,errorMessage}` and `Report.{status,verdict,overallScore,report,confidence,generatedAt}`, with `Report` 1:1 on `requestId`. Unit 07 already persists these. **Do not modify `packages/db/prisma/schema.prisma` or `apps/worker`.** If a genuine blocker appears, stop and document it here first (none is anticipated).

## API Design

A read-only item endpoint, thin and cache-free.

- **Route:** `GET /api/analyses/[id]` → `apps/web/app/api/analyses/[id]/route.ts`.
- **Runtime / caching:** `export const runtime = "nodejs"` (Prisma) and `export const dynamic = "force-dynamic"` (status must never be cached/prerendered). The client also fetches with `cache: "no-store"`.
- **Behavior:** validate the `id` path param is present; `prisma.analysisRequest.findUnique({ where: { id }, include: { job: true, report: true } })`; map to the DTO. No writes, no provider/scoring logic (Invariant 1).
- **Response envelope:** the shared `ApiResponse<AnalysisStatusResponse>` (`ok`/`err` helpers from `@kol-fit/shared`).
  - Found → HTTP 200 `ok(dto)`.
  - Not found (`findUnique` returns null) → HTTP 404 `err("not_found", "Analysis not found.")`.
  - DB/unexpected error → HTTP 500 `err("internal_error", "Failed to load analysis status.")` — no stack/secret leak (Invariant 10); `console.error` server-side only. (With no DB reachable this is the offline path.)
- **DTO type — `AnalysisStatusResponse`:** defined once in a web-only module `apps/web/lib/analysis-status.ts` and imported by **both** the route and the client component (single source, no drift). It reuses shared enum/`FitReport` types; this is a type-only file — **no `packages/shared` change and no new Zod schema** (the client trusts its own API; the report JSON was already validated on write in Unit 07):

  ```ts
  import type { JobStatus, ReportStatus, ReportVerdict, FitReport } from "@kol-fit/shared";

  export type AnalysisStatusResponse = {
    id: string;
    orgHandle: string;
    kolHandle: string;
    createdAt: string; // ISO
    job: {
      status: JobStatus;
      startedAt: string | null;
      completedAt: string | null;
      failedAt: string | null;
      errorCode: string | null;
      errorMessage: string | null;
    };
    report: {
      status: ReportStatus;
      verdict: ReportVerdict | null;
      overallScore: number | null;
      generatedAt: string | null;
      fitReport: FitReport | null; // Report.report JSON (already validated on save)
    } | null;
  };
  ```

  The route maps Prisma dates to ISO strings and casts `report.report` to `FitReport | null` (optionally re-validating with `FitReportSchema`, degrading to `null` if it ever fails). The **top-level display state is `job.status`** (the canonical lifecycle); `report` is present once the worker has upserted it.

## UI / UX Design

Follows `ui-context.md` (Layout Patterns → Report Page header; Status States; Empty States) and the dark theme tokens (no hardcoded hex).

- **Page (`app/analyses/[id]/page.tsx`):** stays a minimal Server Component — reads `params.id` and renders the client `<AnalysisStatus id={id} />`. All fetching/polling/rendering lives in the client component.
- **Client component (`apps/web/components/analysis-status.tsx`, `"use client"`):** owns fetch + poll + state rendering.
- **Header (shown once any data loads, all non-error states):** org handle vs KOL handle, a **status badge**, and (when completed) the generated timestamp; request id in `font-mono`. Status badge uses tokens **with a text label** (never color alone — Invariant/ui-context): queued/running → info/muted (`text-info`/`bg-muted`), completed → success (`text-success`), failed → error (`text-error`). Include a small lucide icon per state (`Clock` queued, `Loader2`/`Activity` running, `CheckCircle2` completed, `AlertTriangle` failed).
- **States:**
  - **Loading (initial fetch pending):** a centered card with a `Loader2` spinner and "Loading status…".
  - **Queued:** status card — "Queued", "Waiting to start." Polling active.
  - **Running:** status card — spinner + "Running", "Analysis in progress." Polling active. **Do not fake a progress percentage** (ui-context — no fabricated progress; there is no real stage progress yet).
  - **Completed:** the compact placeholder report card (below). Polling stopped.
  - **Failed:** error card (below). Polling stopped.
  - **Not found (404):** simple card "Analysis not found" + a link/Button back to `/` ("Start a new analysis"). Terminal (no polling).
  - **Load error (initial fetch 500/network, no prior data):** error card "Couldn't load this analysis." with a "Try again" button that re-fetches.
- **Back link:** a subtle "← New analysis" link to `/` on terminal states.
- Keep the component reusable and modest; do not build a dashboard.

## Status Polling Behavior

- On mount, fetch `GET /api/analyses/[id]` with `cache: "no-store"`.
- **Poll while non-terminal:** if `job.status` is `QUEUED` or `RUNNING`, schedule the next fetch ~**2500 ms** later (recursive `setTimeout`, not `setInterval`, so requests never overlap).
- **Stop polling on terminal:** `job.status === "COMPLETED"` or `"FAILED"`, or a `not_found` (404) response. No further requests are made.
- **Transient poll errors** (a fetch/500 after we already have data): keep the last known state and keep polling (do not flip to a terminal error). Only a *first* fetch with no prior data shows the load-error card.
- **Cleanup:** clear any pending timer on unmount (guard against setState-after-unmount).
- No exponential backoff needed for this unit (jobs complete in well under a second); a fixed short interval is sufficient. No fabricated progress.

## Completed Report Placeholder Behavior

When `job.status === "COMPLETED"` and `report` is present, render a **compact** report card from saved values only (no recalculation, no Unit 15 renderer):

- **Header:** org vs KOL, "Completed" success badge, generated timestamp.
- **Verdict:** a badge with the verdict label (e.g. `OKAY`), mapped to a success/warning/error tone per `ui-context` score-color usage (with the text label present).
- **Overall score:** the saved `overallScore` (or `fitReport.overallScore.value`) rendered as a mono number (e.g. `0 / 100`).
- **Confidence:** `fitReport.confidence` (e.g. "low").
- **Placeholder banner:** surface `fitReport.evidence.notes[0]` (the "PLACEHOLDER report …" string from Unit 07) prominently in a muted/info note so it is unmistakable this is not a real analysis yet.
- **Defensive:** if `job.status === "COMPLETED"` but `report` is `null` (shouldn't happen), show "Report unavailable." rather than crashing.

All values come straight from the DTO (saved DB state). The client computes nothing.

## Failed / Error Behavior

- **Job failed (`job.status === "FAILED"`):** an error card — "Analysis failed", showing `job.errorMessage` if present (already sanitized on write, e.g. "Worker failed to process the analysis job.") else a generic reason; optionally note `errorCode`. No retry action (Unit 21 owns reliability). A "← New analysis" link.
- **Not found (404):** "Analysis not found." card + back link.
- **Initial load error (500/network):** "Couldn't load this analysis." card + "Try again". Never surface raw exception text.
- The page never exposes server internals; it renders only DTO fields / generic copy.

## Implementation Steps

1. **`apps/web/lib/analysis-status.ts`** — the `AnalysisStatusResponse` DTO type (above).
2. **`apps/web/app/api/analyses/[id]/route.ts`** — `GET` handler: `runtime="nodejs"`, `dynamic="force-dynamic"`; `findUnique` with `{ job, report }`; map to DTO (ISO dates, `report.report` → `FitReport`); return `ok(dto)` / `err("not_found")` (404) / `err("internal_error")` (500) via the shared helpers.
3. **`apps/web/components/analysis-status.tsx`** (`"use client"`) — fetch + recursive-`setTimeout` poll while queued/running, stop on terminal/404, transient-error tolerance, cleanup on unmount; render the header + per-state UI (loading/queued/running/completed/failed/not-found/load-error) using existing primitives (`Card`, `Badge`, `Button`, `Separator`) + lucide icons.
4. **`apps/web/app/analyses/[id]/page.tsx`** — replace the placeholder body with `<AnalysisStatus id={id} />` (keep it a minimal Server Component that awaits `params`).
5. **Reuse** existing shadcn primitives and theme tokens; **no new primitives**, no hardcoded hex.
6. **Do not touch** `packages/*`, `apps/worker`, the Prisma schema, or the existing `POST /api/analyses` route.

## Dependencies

- **No new npm packages** and **no new UI primitives** (reuse `Card`, `Badge`, `Button`, `Separator`, `lucide-react`). `@kol-fit/db` + `@kol-fit/shared` already available in `apps/web`.
- **No `packages/shared` change** (DTO lives in `apps/web/lib/`).
- Explicitly **not** introduced: polling libraries, data-fetching libraries (plain `fetch` + `setTimeout`), provider SDKs, auth.

## Verification Checklist

### Offline (no `DATABASE_URL`)

- [ ] `pnpm build` passes across all workspace projects (route + client component + page compile); `components/ui/` still has exactly the 8 primitives; no hardcoded hex in new code.
- [ ] `GET /api/analyses/anything` with no DB returns a clean **HTTP 500** `{ ok: false, error: { code: "internal_error" } }` (no crash/leak).
- [ ] Loading `/analyses/anything` in the browser shows the loading state then a graceful **load-error** card (the fetch 500s with no DB) — confirms mount + fetch + error handling without a database.

### Online (throwaway/local Postgres, schema applied; web + worker running)

- [ ] Submitting the form redirects to `/analyses/<id>`; the page shows **queued/running** and **polls** the endpoint, then flips to **completed** and **stops polling** (no further `GET /api/analyses/<id>` requests after completion).
- [ ] Completed state renders the compact placeholder report: verdict, overall score, confidence, and the visible "PLACEHOLDER report …" note; values match the saved `Report` row.
- [ ] `GET /api/analyses/<id>` (curl) returns the `ApiResponse<AnalysisStatusResponse>` shape with `job.status` and (once done) a non-null `report`.
- [ ] **Failed state:** a job set to `FAILED` (e.g. a request whose job is marked failed) renders the failed card with the saved `errorMessage`.
- [ ] **Not-found:** `/analyses/does-not-exist` returns 404 from the API and the page shows the "Analysis not found" card.

### Scope guardrails

- [ ] No Prisma schema, worker, provider, LLM, scoring, or pipeline changes; the `POST /api/analyses` route is unchanged; the new route is read-only.
- [ ] No full report renderer (Unit 15), no auth, no reports list, no share/export.
- [ ] Nothing is recomputed client-side; the UI renders saved DB state only.
- [ ] `context/progress-tracker.md` updated once implemented.
- [ ] No commits made.
```
