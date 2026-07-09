# Unit 15: Final Report Renderer

## Goal

Replace the compact placeholder completed-state card in `AnalysisStatus` with a proper, human-readable **fit report renderer** that displays the saved `FitReport` (15 sections) and the full deterministic `ScoreBreakdown` (9 metrics) for a COMPLETED analysis on `/analyses/[id]`. Built for internal agency review: clarity over flash, saved DB state only, no recalculation.

This is a **renderer** unit — no analysis, scoring, provider, pipeline, or worker logic. The database `Report` JSON stays the source of truth.

Explicit non-goals (later / never):

- No live TwitterAPI.io, no OpenAI/LLM, no scoring/pipeline/worker changes.
- No saved-reports list, no auth, no share links, no PDF/export.
- No Prisma schema change (none required — see API/DTO section).
- No fancy charting libraries — simple CSS bars/sections only.
- No commits.

## Report Data Assumptions

- The report page already fetches `GET /api/analyses/[id]` and polls until terminal (Unit 09). For a COMPLETED job the DTO carries `report.fitReport` (a validated `FitReport`) — this is unchanged.
- **`FitReport` embeds only 6 of the 9 score metrics** as `ScoreValue`s: `overall_fit` (`overallScore`), `engaged_audience_match` (`audienceMatch.score`), `paid_promo_risk` (`paidPromo.riskScore`), `bot_farm_risk` (`botFarmRisk.riskScore`), `brand_safety` (`brandSafety.score`), `geo_language_fit` (`geoLanguageFit.score`). The other **three** — `content_fit`, `audience_quality`, `campaign_goal_fit` — exist only in the `Report.scores` column (`ScoreBreakdown`).
- Therefore the renderer needs `Report.scores` too. It is added to the DTO (API/DTO section below). `ScoreBreakdown` = `{ overall, components: partialRecord<ScoreMetric, ScoreValue>, confidence }`; each `ScoreValue` = `{ value 0–100, confidence, reasons[] }`.
- The report **spine** (`schemaVersion`, `overallScore`, `verdict`, `confidence`, `evidence`) is always present; narrative sections are optional and may be absent (Unit 15 must degrade gracefully — the FitReport schema makes them `.optional()`).
- The scores/verdict are the deterministic Unit 14 output; the renderer never recomputes them — bar widths are a pure CSS mapping of a saved number, not a score computation.

## API / DTO Compatibility

One **additive, read-only** DTO change (justified: the 9-metric requirement can't be met from `FitReport` alone):

- `apps/web/lib/analysis-status.ts`: add `scores: ScoreBreakdown | null` to the `report` object of `AnalysisStatusResponse` (import `ScoreBreakdown` from `@kol-fit/shared`).
- `apps/web/app/api/analyses/[id]/route.ts`: parse `report.scores` with `ScoreBreakdownSchema` defensively (`safeParse` → `null` on failure, exactly like the existing `fitReport` handling) and include it in the DTO.
- No Prisma schema change (the `Report.scores` column exists since Unit 03). No shared-package change (`ScoreBreakdown`/`ScoreBreakdownSchema` already exported). Backward-compatible: existing consumers ignore the new field; older rows with no `scores` → `null`.

## Report UI/UX Design

- **Layout:** for a COMPLETED job with a report, the page renders a wider `<FitReportView>` (e.g. `max-w-4xl`) instead of the compact `max-w-2xl` card; queued/running/failed/not-found states keep the existing compact shell. The "New analysis" back-link stays at the top.
- **Reading order (top → bottom), analyst-first:**
  1. **Header/hero:** `@org vs @kol`, request id, generated timestamp; a prominent **verdict** badge, **overall score** (large `NN / 100` + a bar), and **confidence** chip.
  2. **Score matrix:** all 9 metrics at a glance (compact meters, grouped: fit metrics then the 2 risk metrics).
  3. **Recommendation:** best use cases / weak use cases / recommended campaign angle.
  4. **Audience:** audience match summary + audience breakdown bars.
  5. **Content & engagement:** KOL content analysis, engagement quality.
  6. **Risk & safety:** paid-promo, bot/farm, brand safety, geo/language.
  7. **Evidence:** sample sizes + notes + confidence.
- **Visual style:** the existing dark analyst-dashboard theme and tokens only (`bg-elevated`, `text-muted-foreground`, `border-*`, `text-success/warning/error/info/accent-hover`, etc.). Reuse `Card`/`Badge`/`Separator`. **No hardcoded hex.** Sections are titled Cards or bordered blocks separated by `Separator` — scannable, dense, not flashy.

## Section-by-Section Renderer Design

All 15 FitReport sections map to blocks; optional sections render only when present. `ScoreValue`s come from `scores` (authoritative for numbers); narratives come from `fitReport`.

| # | Section | Source | Rendering |
| --- | --- | --- | --- |
| 1 | Overall fit score | `scores.overall` (fallback `fitReport.overallScore`) | hero: big `value/100` + bar + reasons |
| 2 | Verdict | `fitReport.verdict` | hero badge, tone by verdict |
| 3 | Best use cases | `fitReport.bestUseCases[]` | bulleted list (omit if empty) |
| 4 | Weak use cases | `fitReport.weakUseCases[]` | bulleted list (omit if empty) |
| 5 | Audience match | `fitReport.audienceMatch` | summary text + `engaged_audience_match` meter |
| 6 | Audience breakdown | `fitReport.audienceBreakdown` | per-bucket bars (see below) |
| 7 | KOL content analysis | `fitReport.contentAnalysis` | themes/verticals/style/depth chips + narrative |
| 8 | Engagement quality | `fitReport.engagementQuality` | narrative + signal chips |
| 9 | Paid promo detection | `fitReport.paidPromo` | narrative + `paid_promo_risk` meter (**risk mode**) |
| 10 | Bot/farm risk | `fitReport.botFarmRisk` | narrative + `bot_farm_risk` meter (**risk mode**) |
| 11 | Brand safety | `fitReport.brandSafety` | narrative + `brand_safety` meter |
| 12 | Geo/language fit | `fitReport.geoLanguageFit` | narrative + `geo_language_fit` meter |
| 13 | Campaign angle | `fitReport.recommendedAngle` | callout text (omit if absent) |
| 14 | Evidence / sample size | `fitReport.evidence` | sample-size key/values + notes list |
| 15 | Confidence level | `scores.confidence` / `fitReport.confidence` | hero chip + short caption |

**Score matrix (all 9 metrics):** built from `scores` — `overall` + the 8 components. Fit metrics (`overall_fit`, `content_fit`, `engaged_audience_match`, `audience_quality`, `campaign_goal_fit`, `geo_language_fit`, `brand_safety`) shown as higher-is-better; the 2 risk metrics shown in **risk mode**. Metric display names via a local `SCORE_METRIC_LABELS` map in the web component (no shared change). When a metric is missing from `components`, its tile shows "—/not scored" rather than breaking.

## Score Display Behavior

A reusable `<ScoreMeter>` renders one `ScoreValue`:

- A horizontal CSS bar: `width: {value}%` (inline style from the saved number). Label `NN / 100`, the metric name, and a small confidence chip.
- **Fit mode (higher = better):** bar color by band — e.g. `≥ 65` success, `40–64` warning, `< 40` error (theme tokens). 
- **Risk mode (higher = worse):** color **inverted** — high value = error/red, low = success/green — plus an explicit "Risk · higher is worse" caption/tag so direction is unmistakable.
- `reasons[]` render as a muted, small bulleted/again list beneath (the "explainable, not magic numbers" payoff). Long reason lists may be shown compactly but must not be hidden entirely.
- Never recomputes: the component receives the saved `ScoreValue` and only maps `value`→width/color.

## Audience Breakdown Display Behavior

`<AudienceBars>` from `fitReport.audienceBreakdown` (an `AudienceDistribution`):

- Show `sampleSize` ("n engaged accounts sampled").
- One row per observed bucket, sorted by `share` desc: bucket label (via shared `AUDIENCE_BUCKET_LABELS`), a CSS bar `width: {share*100}%`, and `count` + `share%`.
- **Low-quality buckets** (`bots_spam`, `giveaway_hunters`, `airdrop_farmers`) get a subtle warning tint + a small flag, so an analyst instantly sees audience quality drags.
- Empty distribution (`sampleSize 0` / no buckets) → a muted "No engaged accounts were sampled." No division without a guard.

## Evidence / Sample-Size Display Behavior

From `fitReport.evidence`:

- `sampleSizes` → a compact labelled key/value grid (e.g. `kolPosts`, `kolReplies`, `topPostsAnalyzed`, `engagedAccounts`, `websiteChars`, `docsChars`), humanizing keys; integers only.
- `notes[]` → a muted list (includes the deterministic-scoring + provider/ingestion notes). This is analyst-facing debugging context, styled as secondary info, not an alarm.
- Paired with the overall confidence so reviewers can gauge how much to trust the report.

## Risk Display Behavior

- The two risk metrics (`paid_promo_risk`, `bot_farm_risk`) are always rendered in **risk mode** (inverted color + "higher is worse" caption), both in the score matrix and in their narrative sections (9, 10).
- A short legend near the score matrix states the convention once ("Risk metrics: higher = worse").
- Fit metrics never use risk coloring; risk metrics never use fit coloring — so a green risk bar can't be misread as good.

## Missing / Partial Data Behavior

- **Spine always renders:** overall score, verdict, confidence, evidence. If `scores` is `null` (older row / parse failure), fall back to the metrics embedded in `fitReport` (the 6) and show "full breakdown unavailable" for the missing 3 — never crash.
- **Optional narrative sections absent → omitted** (no empty headers, no "null"); empty arrays (`bestUseCases`, `signals`, `notes`) → section hidden or a subtle "None".
- **`fitReport` null but `report` present** (parse failure): keep the existing minimal completed fallback using the flat DTO `overallScore`/`verdict` + a "report unavailable" note.
- **`report` null on a COMPLETED job:** existing "Completed, but the report is unavailable." message (unchanged).
- All optional-field access is guarded; the renderer must not throw on any partial report.

## Implementation Steps

1. **DTO + route (web-only):** add `scores: ScoreBreakdown | null` to `apps/web/lib/analysis-status.ts`; parse `report.scores` with `ScoreBreakdownSchema` in `apps/web/app/api/analyses/[id]/route.ts` (defensive → null).
2. **New components** under `apps/web/components/report/`:
   - `fit-report-view.tsx` — top-level layout orchestrating hero + all sections (props: `fitReport`, `scores`, and meta `{ orgHandle, kolHandle, requestId, generatedAt }`).
   - `score-meter.tsx` — reusable `<ScoreMeter value={ScoreValue} label kind="fit"|"risk" />`.
   - `score-matrix.tsx` — the 9-metric grid built from `scores` (+ `SCORE_METRIC_LABELS`, risk-metric set).
   - `audience-bars.tsx` — `AudienceDistribution` bars with low-quality flagging.
   - `report-section.tsx` — titled section/Card wrapper for consistent headings.
3. **`analysis-status.tsx`:** in the COMPLETED branch, when `fitReport` is present render `<FitReportView …/>` (wider container) instead of `CompletedBody`; keep the `fitReport`-null and `report`-null fallbacks. Remove the old placeholder-note banner (Unit 14 removed placeholders; notes now live in the Evidence section). Queued/running/failed/not-found unchanged.
4. **No new `components/ui/` primitives** (stay at 8); simple CSS bars, no chart lib, no accordion. Reuse `Card`/`Badge`/`Separator`/`lucide-react`.
5. Confirm **no** changes to scoring, pipeline, worker, Prisma schema, or shared.

## Dependencies

- No new npm packages (`lucide-react`, Tailwind, existing UI primitives suffice).
- No new workspace deps (web already depends on `@kol-fit/shared` + `@kol-fit/db`). `ScoreBreakdown`/`ScoreBreakdownSchema`, `AUDIENCE_BUCKET_LABELS`, `ScoreMetric` all come from `@kol-fit/shared`.

## Verification Checklist

Primary rendering verification is a **headless-Chrome drive** against the running app with a real completed report (online, disk-light — throwaway Postgres + worker + `next dev`; mind the low-disk note and tear down). Build/typecheck is offline.

- [ ] `pnpm build` passes across all workspace projects (renderer + route typecheck; `components/ui/` still exactly 8; no hardcoded hex in new code).
- [ ] **DTO/route:** `GET /api/analyses/[id]` for a completed report returns `report.scores` as a valid `ScoreBreakdown` (curl/JSON check); malformed scores → `null` without 500.
- [ ] Offline: `/analyses/<id>` still SSRs the loading shell (client component) and the build has no type errors from the new components.

Online headless-Chrome (completed report produced via the worker, as in Units 08/09/13):
- [ ] **Hero:** verdict badge, overall `NN / 100`, and confidence all render and **match the saved DB values** (no client recalculation — compare rendered numbers to `Report.overallScore`/`verdict`/`scores.confidence`).
- [ ] **All 9 metrics** appear in the score matrix with values equal to `scores` (`overall` + 8 components), each with a bar and its confidence.
- [ ] **Risk direction obvious:** `paid_promo_risk` and `bot_farm_risk` tiles/sections show a "higher is worse" caption and inverted (red-for-high) coloring; a risk legend is present.
- [ ] **All 15 sections** present when the report is complete: overall, verdict, best/weak use cases, audience match, audience breakdown (bars + sampleSize), content analysis, engagement quality, paid promo, bot/farm, brand safety, geo/language, campaign angle, evidence (sample sizes + notes), confidence.
- [ ] **Audience breakdown** shows per-bucket bars with human labels; low-quality buckets flagged; `sampleSize` shown.
- [ ] **Evidence** shows sample-size key/values + notes (the deterministic-scoring/provider notes), not a placeholder warning banner.
- [ ] **Missing/partial data:** with a report whose optional sections are stripped (patch `Report.report` to spine-only, or a second fixture), the spine (overall/verdict/confidence/evidence) still renders and absent sections are cleanly omitted — no crash, no "null"/empty headers. With `scores` null, the 6 embedded metrics still render and the 3 others show "unavailable".
- [ ] No console errors; queued/running/failed/not-found states are unchanged from Unit 09.

Scope guardrails:
- [ ] No scoring/pipeline/worker/Prisma-schema/shared changes; the only non-UI edit is the additive `scores` DTO field + its route parse.
- [ ] UI renders saved report fields only — no scoring/LLM/provider calls, no score recomputation (grep the new components for any arithmetic on metric values beyond bar-width mapping).
- [ ] `context/progress-tracker.md` updated once implemented.
- [ ] No commits made.
```
