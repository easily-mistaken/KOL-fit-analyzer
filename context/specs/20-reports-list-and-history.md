# Unit 20: Reports List and Saved Report History

## Goal

Make previously-run analyses discoverable. Today the only way to reach a report is the redirect right after submitting the form (`/analyses/[id]`); once you navigate away, the id is lost. This unit adds a **saved-reports list** so an internal user can see every analysis, its status/verdict/score, and open any past report.

Per the build plan (Unit 20), the list shows, per analysis:

- org handle / KOL handle
- created date
- job status (QUEUED / RUNNING / COMPLETED / FAILED)
- verdict (when completed)
- overall score (when completed)
- a link to open the full report

Verification target: completed reports are visible from the dashboard, and the user can open old reports.

This is a **read-only UI + read API** unit. No worker, pipeline, provider, scoring, or LLM changes. No new analysis behavior.

Explicit non-goals (later / never this unit):

- No filtering/search (by handle, status, verdict, date) — deferred; note as a future extension.
- No sorting controls (fixed newest-first) — deferred.
- No delete / archive / rename of reports.
- No re-run / duplicate action from the list.
- No auth/workspace scoping beyond the existing single-internal-workspace assumption (`workspaceId` null).
- No schema change (see below).
- No commits.

## No Schema Change (justified)

Everything the list needs already exists on `AnalysisRequest` + `Report`, with the right indexes:

- `AnalysisRequest`: `id`, `orgHandle`, `kolHandle`, `createdAt`, relations `job`, `report`. Indexes: `@@index([createdAt])`, `@@index([orgHandle])`, `@@index([kolHandle])`.
- `AnalysisJob`: `status`.
- `Report`: `status`, `verdict`, `overallScore`, `generatedAt`. Indexes: `@@index([status])`, `@@index([verdict])`, `@@index([createdAt])`.

The list is driven off `AnalysisRequest` (the durable per-analysis row that always exists, even while QUEUED/RUNNING before a `Report` exists) ordered by `createdAt desc`, joining `job` (for live status) and `report` (for verdict/score once present). **No migration.** State this explicitly to avoid scope creep — this unit is purely additive read code.

## Data Source and List DTO

Add a small typed list DTO, defined once and shared by the route and the page (mirroring `AnalysisStatusResponse` in `apps/web/lib/analysis-status.ts`). Put it in `apps/web/lib/analyses-list.ts`:

```ts
export type AnalysisListItem = {
  id: string;             // AnalysisRequest.id (report link target)
  orgHandle: string;
  kolHandle: string;
  createdAt: string;      // ISO
  jobStatus: JobStatus;   // live job state
  report: {
    status: ReportStatus;
    verdict: ReportVerdict | null;
    overallScore: number | null;   // 0..100
    generatedAt: string | null;    // ISO
  } | null;               // null until the worker writes a Report
};

export type AnalysisListResponse = {
  items: AnalysisListItem[];
  nextCursor: string | null;   // for "load more"; null when no more
};
```

The Prisma query **must select only summary columns** — never load the heavy `report.report` / `report.scores` JSON blobs for the list (perf + code-standards "avoid loading unnecessary full data"):

```ts
prisma.analysisRequest.findMany({
  orderBy: { createdAt: "desc" },
  take: limit + 1,                    // +1 to detect a next page
  ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  select: {
    id: true, orgHandle: true, kolHandle: true, createdAt: true,
    job: { select: { status: true } },
    report: { select: { status: true, verdict: true, overallScore: true, generatedAt: true } },
  },
});
```

## Read API: `GET /api/analyses`

Extend the existing `apps/web/app/api/analyses/route.ts` (currently POST-only) with a **thin, read-only** `GET` handler returning `ApiResponse<AnalysisListResponse>` via the standard `ok`/`err` helpers. Rules:

- `runtime = "nodejs"`, `dynamic = "force-dynamic"` (never cached — list changes as jobs run), matching `/api/analyses/[id]`.
- Query params: `?limit` (default 25, clamp 1..100) and `?cursor` (an `AnalysisRequest.id` for cursor pagination). Parse/validate defensively; invalid → defaults.
- Cursor pagination on `createdAt desc` using Prisma `cursor`/`skip:1`/`take:limit+1`: if `limit+1` rows come back, drop the extra and set `nextCursor` to the last kept item's `id`, else `nextCursor: null`.
- No scoring, no provider calls, no JSON-blob loading. Never leak DB errors — `console.error` + `err("internal_error", ...)` + 500, like the other routes.
- Keep the route thin; the query + DTO mapping can live in a `listAnalyses()` helper in `apps/web/lib/analyses-list.ts` so both the API and (optionally) a server component can reuse it.

## Page and Components

### Route: `/analyses` (new)

`apps/web/app/analyses/page.tsx` — a **Server Component** (code-standards: server components by default; the list needs no browser interactivity for the first render). It calls the `listAnalyses()` helper directly (server-side Prisma; no self-fetch) for the first page and renders the list. Keep the page focused on layout + data loading; put the table/rows in a component.

- Do **not** collide with the existing dynamic `apps/web/app/analyses/[id]/page.tsx` — `/analyses` (index) and `/analyses/[id]` coexist in the App Router.

### Component: `components/analyses-list.tsx`

Presentational list of `AnalysisListItem[]`. Recommended layout: a responsive, information-dense **table** (analyst tool — ui-context lists Table and favors scannable tables), server-rendered as a semantic `<table>` styled with Tailwind tokens, wrapped in `overflow-x-auto` for mobile (ui-context: tables scroll/simplify on small screens). Columns:

| KOL → Org | Status | Verdict | Score | Created | (row links to report) |

- Each **row links to `/analyses/[id]`** (wrap the row content in `next/link`, or make the row a `<Link>`), so opening an old report is one click. Use `FileText`/`Activity` iconography per ui-context.
- **Status**: small badge; QUEUED/RUNNING use muted/info tokens, COMPLETED success-ish/neutral, FAILED error token. Text label always present (ui-context: never color-only).
- **Verdict**: reuse the verdict → label/color mapping already used in the report view (STRONG/GOOD/OKAY/WEAK/AVOID → success/warning/error tokens). If that mapping is inline in `components/report/fit-report-view.tsx`, extract a tiny shared `VerdictBadge` (in `components/report/` or `components/`) and reuse it in both places rather than duplicating the color logic. Show "—" when `verdict` is null (not yet completed).
- **Score**: mono/tabular `overallScore` (0–100) when present, else "—".
- **Created**: `createdAt` formatted compactly (date + time). Keep formatting in a small helper; no new date library (use `Intl.DateTimeFormat`/`toLocaleString`).
- **Load more**: if `nextCursor` is set, render a "Load more" affordance. Minimal viable = a `<Link href={"/analyses?cursor=..."}>` that server-renders the next page (no client JS). A client "load-and-append" button is an acceptable alternative but is optional — do not add client state unless needed.

### Empty state

When there are zero analyses: a simple, direct empty state (ui-context) — "No reports yet" + "Create your first KOL fit analysis" with a link/button to `/` (the form). No fake rows.

### Navigation

- Add a **"Reports"** (or "History") nav link to `components/top-nav.tsx` pointing at `/analyses`. This route now genuinely exists, so the existing "we do not fabricate dead nav targets" comment no longer applies — update/replace that comment. Use `next/link`; keep the nav minimal and on-theme.
- Optionally add a secondary link from the home page (`/`) to `/analyses` (e.g., a "View past reports" link near the form). Keep it small; not required if the nav link is present.

## Styling

- Tailwind + shadcn conventions, UI tokens only (no hardcoded hex). Dark, information-dense, scannable (ui-context report/list principles).
- Radius per ui-context (`rounded-xl` cards/panels). Mono/tabular for scores and dates where useful.
- Responsive: table scrolls horizontally on mobile; consider collapsing the Created column on very narrow widths (optional).
- **Do not** rewrite `components/ui/*` primitives. If a shadcn `Table` primitive is wanted, add it via the normal generator (allowed); otherwise a semantic Tailwind-styled `<table>` needs no new primitive (recommended, fewer moving parts).

## Live Status Note (kept simple)

The list is server-rendered once per navigation, so QUEUED/RUNNING rows reflect state at load time. That satisfies the build-plan verification (see completed reports, open old ones). **Live auto-refresh of in-progress rows is out of scope** — the per-analysis detail page already polls (`/analyses/[id]`). A manual browser refresh updates the list. (Optional future: light client polling of non-terminal rows — record as a future extension, do not build now.)

## Error Handling

- API: invalid/oversized `limit` or bad `cursor` → clamp/ignore and return the default page (don't 400 on pagination noise). DB failure → 500 with a generic message; never leak errors/secrets.
- Page/server component: if `listAnalyses()` throws, render a graceful "Couldn't load reports" state rather than crashing the route.
- A report row whose `Report` is missing (job still QUEUED/RUNNING, or FAILED before a report) renders with `report: null` → status from the job, verdict/score "—". No throw.

## Implementation Steps

1. `apps/web/lib/analyses-list.ts`: `AnalysisListItem` / `AnalysisListResponse` types + a `listAnalyses({ limit, cursor })` helper (Prisma summary-select query + DTO mapping + `nextCursor`).
2. `apps/web/app/api/analyses/route.ts`: add the `GET` handler (thin; parse `limit`/`cursor`, call `listAnalyses`, return `ok`/`err`). Leave the existing `POST` untouched.
3. `apps/web/app/analyses/page.tsx`: server-component index page calling `listAnalyses()` and rendering `<AnalysesList>` (+ empty state).
4. `apps/web/components/analyses-list.tsx`: the responsive table/rows, row → `/analyses/[id]` links, status/verdict/score/date cells, "Load more" (cursor link), empty state.
5. Verdict badge: reuse or extract a shared `VerdictBadge` (dedupe the verdict→color mapping with `fit-report-view.tsx`).
6. `components/top-nav.tsx`: add the "Reports" link to `/analyses`; update the stale "no routes yet" comment. (Optional: a link from `/`.)
7. `context/progress-tracker.md`: mark Unit 20 done + session notes. No commits.

## Dependencies

- No new npm packages. No new workspace packages. Uses existing `@kol-fit/db`, `@kol-fit/shared` (`ok`/`err`/`ApiResponse`, `JobStatus`/`ReportStatus`/`ReportVerdict`), `next/link`, `lucide-react`.
- No live-network/provider/LLM deps.

## Verification Checklist

Offline (primary — `pnpm build` + `pnpm check`):

- [ ] `pnpm build` (all projects incl. `apps/web`) + `pnpm check` green.
- [ ] `listAnalyses()` returns items newest-first with the summary DTO shape and **does not** select `report.report`/`report.scores` blobs.
- [ ] Cursor pagination: with `limit=N`, a full page returns `nextCursor` = last item id; a partial/last page returns `nextCursor: null`; passing that cursor returns the next distinct page (no overlap, no dup).
- [ ] DTO maps a request with no `Report` → `report: null`, `jobStatus` from the job; a completed one → verdict/score/generatedAt populated.
- [ ] `GET /api/analyses` returns `ok(AnalysisListResponse)`; bad `limit`/`cursor` → defaults (not 400); DB error path → `err("internal_error")` + 500 (no leak).
- [ ] Empty state renders when there are no analyses; verdict/score render "—" for non-completed rows; row links point at `/analyses/[id]`.
- [ ] No `components/ui/*` primitive rewritten; no schema/migration change; no worker/pipeline/provider/scoring change.

Online (disk-light, local/throwaway Postgres — no billable calls):

- [ ] Seed a few `AnalysisRequest`s (mix of QUEUED/RUNNING/COMPLETED/FAILED, some with a `Report`) → `/analyses` lists them newest-first with correct status/verdict/score; clicking a row opens `/analyses/[id]`.
- [ ] `GET /api/analyses?limit=2` paginates correctly across two requests via `nextCursor`.

Scope guardrails:

- [ ] Read-only: no writes, no scoring, no provider/LLM calls, no long work in the route (code-standards: API routes may "read report status / return saved report data" only).
- [ ] Only additive web files + the `GET` handler + nav link changed; `POST /api/analyses` and the detail flow untouched.
- [ ] `context/progress-tracker.md` updated once implemented. No commits.

## Open Questions / Design Decisions

- **Data access from the page:** server component calls `listAnalyses()` (Prisma) directly (recommended — no self-fetch, matches server-components-by-default) vs the page fetching its own `GET /api/analyses`. Recommend direct helper for the first page; the `GET` API still exists for pagination/programmatic use. Confirm.
- **Layout:** responsive semantic table (recommended, information-dense, no new primitive) vs row-cards vs adding the shadcn `Table` primitive. Recommend the Tailwind-styled table.
- **Pagination:** cursor-based "Load more" via server-rendered `?cursor=` links (recommended, no client JS) vs client load-and-append vs deferring pagination entirely (just newest 25). Recommend cursor links; default page size 25.
- **Filtering/search & live refresh:** both deferred to a later unit. Confirm they're out of scope here.
- **Nav label:** "Reports" vs "History" vs "Analyses". Recommend "Reports".
