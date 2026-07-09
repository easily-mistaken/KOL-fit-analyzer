# Unit 13: Analysis Pipeline Skeleton (with Mocks)

## Goal

Build the first end-to-end **analysis pipeline** in `packages/analysis` that ties together the mock Twitter provider (Unit 10), the mock LLM provider (Unit 11), and website/docs ingestion (Unit 12) into a single `runAnalysis()` orchestration that produces a validated `FitReport` plus structured evidence. Wire the worker to call this pipeline **instead of** the Unit 07 `buildPlaceholderReport`, and persist a richer (but still placeholder-scored) `Report` using the existing schema.

Numeric scoring stays a **clearly-marked placeholder** — deterministic scoring is Unit 14. This unit is the integration skeleton: real data plumbing, mock intelligence, placeholder scores.

Explicit non-goals for this unit (later units own these):

- **No deterministic scoring** (Unit 14) — scores are placeholders behind a single seam.
- **No live network:** no TwitterAPI.io (Unit 16), no OpenAI (Unit 17). Website/docs ingestion is wired but runs **off by default** in the worker and only ever through an **injectable fetch** (verification stays offline).
- No UI change; no API-route change; **no Prisma schema change** (justified below — none is required).
- No caching/cost controls beyond the existing metadata placeholders.
- No commits.

## Pipeline Architecture

All orchestration lives under `packages/analysis/src/pipeline/`. The pipeline depends only on **provider interfaces + factories**, never on concrete `Mock*` classes, so Units 16/17 swap providers with zero pipeline changes. It does **not** depend on `@kol-fit/db` — persistence stays in the worker (clean separation).

```
packages/analysis/src/pipeline/
  types.ts             # AnalysisRequestData, RunAnalysisOptions, AnalysisResult, PipelineEvidence
  select-posts.ts      # deterministic top-post selection by engagement
  collect-engagement.ts# gather + dedupe + cap engaged accounts across top posts
  placeholder-scores.ts# buildPlaceholderScores(): ScoreBreakdown (the Unit 14 seam)
  run-analysis.ts      # runAnalysis(request, options): the orchestration
```

Stages inside `runAnalysis` (each stage feeds the next; all counts bounded by `ANALYSIS_CAPS`):

1. **Website/docs ingestion** (optional, off by default in Unit 13) → `OrgContext`.
2. **Twitter fetch** (mock): org profile, KOL profile, KOL posts, KOL replies; select top posts; fetch replies/quotes/retweeters per top post; aggregate engaged accounts.
3. **LLM classification** (mock): org, KOL content, engaged audience.
4. **Placeholder scoring**: `buildPlaceholderScores()` (marked pending Unit 14).
5. **Report synthesis**: `llm.generateFitReport({ …, scores, verdict })` → validate with `FitReportSchema`.
6. **Assemble** `AnalysisResult` (report + scores + evidence) for the worker to persist.

## Input / Output Design

Plain, Prisma-free types in `packages/analysis` (the worker maps its Prisma row to these — keeps the pipeline decoupled):

```ts
export type AnalysisRequestData = {
  orgHandle: string;
  kolHandle: string;
  websiteUrl?: string | null;
  docsUrl?: string | null;
  // manual brief (override inferred org fields — Invariant 7)
  productCategory?: string | null;
  targetUser?: string | null;
  campaignGoal?: string | null;
  stage?: string | null;
  region?: string | null;
};

export type RunAnalysisOptions = {
  twitter?: TwitterProvider;      // default: createTwitterProvider()  (mock via env)
  llm?: LlmProvider;              // default: createLlmProvider()       (mock via env)
  caps?: AnalysisCaps;            // default: ANALYSIS_CAPS
  performWebIngestion?: boolean;  // default: false (Unit 13 — no live calls)
  ingest?: typeof ingestOrgContext; // injectable (tests); default the real module fn
  ingestOptions?: IngestOptions;  // injectable fetchImpl/now for offline ingestion
  now?: () => Date;               // default () => new Date()
  twitterProviderKind?: string;   // evidence label; default process.env.TWITTER_PROVIDER ?? "mock"
  llmProviderKind?: string;       // evidence label; default process.env.LLM_PROVIDER ?? "mock"
};

export type PipelineEvidence = {
  orgHandle: string;
  kolHandle: string;
  kolPostsSampled: number;
  kolRepliesSampled: number;
  topPostsAnalyzed: number;
  engagedAccountsSampled: number;
  audienceDistribution: AudienceDistribution;
  websiteStatus: SourceStatus;   // fetched | failed | skipped
  docsStatus: SourceStatus;
  twitterProviderKind: string;   // "mock" in Unit 13
  llmProviderKind: string;       // "mock" in Unit 13
  llmModel: string;              // llm.model
  confidence: ConfidenceLevel;
};

export type AnalysisResult = {
  report: FitReport;             // validated against FitReportSchema
  scores: ScoreBreakdown;        // placeholder (pending Unit 14)
  evidence: PipelineEvidence;
  llmModel: string;
  generatedAt: string;           // ISO, from options.now
};

export function runAnalysis(
  request: AnalysisRequestData,
  options?: RunAnalysisOptions
): Promise<AnalysisResult>;
```

`runAnalysis` is the **only** report builder in the system after this unit; the worker just maps `AnalysisResult` → `Report` columns.

## Org Context Analysis Behavior

- Fetch the org profile via `twitter.getUserProfile(orgHandle)` (may be `null` → degrade, don't crash).
- If `performWebIngestion` is true, ingest website/docs (below) and pass `combinedText` as `websiteText`.
- Call `llm.classifyOrgProfile({ handle: orgHandle, profile, websiteText, manualBrief })` where `manualBrief` maps the request's non-null `productCategory` / `targetUser` / `stage` / `campaignGoal` / `region`. The mock **echoes manual fields verbatim** (Invariant 7); inferred fields fill the rest.
- Output `OrgClassification` flows into `generateFitReport`'s `org.classification`.

## KOL Content Analysis Behavior

- `twitter.getUserProfile(kolHandle)`, `twitter.getUserTweets(kolHandle, caps.kolPostsFetched)`, `twitter.getUserReplies(kolHandle, caps.kolRepliesFetched)`.
- `llm.classifyKolContent({ handle, profile, posts, replies })` → `KolContentClassification` (themes, verticals, style, depth, promoPatterns, repeatedTickers).
- `kolPostsSampled` = posts length; `kolRepliesSampled` = replies length (recorded in evidence + `sampleSizes`).

## Engaged Audience Analysis Behavior

- **Top-post selection** (`select-posts.ts`): rank KOL posts by an engagement heuristic (e.g. `likeCount + retweetCount + replyCount + quoteCount`, missing counts → 0), take the top `caps.topPostsForDeepAnalysis`. Deterministic (stable sort with tweet `id` as tiebreaker).
- For each selected post, fetch `getTweetReplies(id, caps.repliesPerPost)`, `getTweetQuotes(id, caps.quotesPerPost)`, `getTweetRetweeters(id, caps.retweetersPerPost)`.
- **Aggregate** (`collect-engagement.ts`): concatenate all `EngagedAccountRaw`, **dedupe by `user.id`** (first occurrence wins, preserving its `source`), then cap at `caps.maxUniqueEngagedAccounts`. Deterministic order.
- `llm.classifyAudienceAccounts({ accounts })` → `AudienceClassification` (accounts + `distribution`).
- `engagedAccountsSampled` = deduped-capped count; `audienceDistribution` = the distribution (recorded in evidence + persisted to `Report.audienceSummary`).

## Website/Docs Ingestion Integration

- The pipeline calls `ingest({ websiteUrl, docsUrl }, ingestOptions)` **only when `performWebIngestion === true`**; otherwise both sources are recorded as `skipped` and **no fetch is attempted** (Unit 13 makes zero live network calls by default).
- When enabled, ingestion is fully graceful (Unit 12): per-source failure never aborts the analysis (Invariant 8); `combinedText` feeds `classifyOrgProfile`.
- `websiteStatus` / `docsStatus` are recorded in evidence and in the report notes for debugging. Verification exercises the enabled path with an **injected `fetchImpl`** (offline).
- Flipping the worker to live ingestion is a later-unit change (a single option); Unit 13 keeps it off.

## Mock Provider Usage

- Providers come from `createTwitterProvider()` / `createLlmProvider()` (factories) unless injected via options. Factories default to the **mock** kind (env `TWITTER_PROVIDER` / `LLM_PROVIDER`, default `"mock"`). The pipeline never imports `MockTwitterProvider` / `MockLlmProvider` directly.
- All Twitter/LLM specifics stay inside their packages; the pipeline sees only the interfaces + shared schemas.

## Evidence / Sample-Size Behavior

Two carriers, both populated:

1. **`FitReport.evidence`** (persisted in `Report.report` JSON, rendered by Unit 15): `sampleSizes` gets `{ kolPosts, kolReplies, topPostsAnalyzed, engagedAccounts, websiteChars, docsChars }` (integers ≥ 0); `notes` includes a clear mock/placeholder banner (below) and ingestion statuses.
2. **`PipelineEvidence`** (structured, for the worker to persist into `Report.sampleSize` + `Report.audienceSummary` JSON columns and for debugging): the fields listed in Input/Output — analyzed org/KOL handle, posts sampled, engaged accounts sampled, audience distribution, website/docs status, provider kinds, llm model, confidence.

This satisfies "enough evidence for later debugging" using existing columns.

## Placeholder Scoring Behavior

- `buildPlaceholderScores()` returns a valid `ScoreBreakdown` (validated by `ScoreBreakdownSchema`) with `overall` and all 9 `components` set to `{ value: 0, confidence: "low", reasons: ["Placeholder for <metric>; deterministic scoring lands in Unit 14."] }`, and `confidence: "low"`.
- These scores + a placeholder `verdict: "OKAY"` are passed to `generateFitReport`, so the `FitReport`'s numeric fields are the placeholder values (consistent with Unit 07's placeholder posture: `overallScore 0` / `OKAY` / `low`).
- The pipeline adds an explicit evidence note: `"SCORES ARE PLACEHOLDERS — deterministic scoring is not implemented until Unit 14."` (the mock's own auto-note only fires when scores are absent; here we pass scores, so the pipeline adds the banner).
- **`buildPlaceholderScores()` is the single seam Unit 14 replaces** with the real `packages/scoring` call — no other pipeline change needed then.

## Report Persistence Behavior

The worker maps `AnalysisResult` → existing `Report` columns (no schema change). Fields written on the upsert:

| Report column | Source |
| --- | --- |
| `status` | `"COMPLETED"` |
| `overallScore` (Int) | `report.overallScore.value` |
| `verdict` | `report.verdict` |
| `scores` (Json) | `result.scores` (placeholder `ScoreBreakdown`) |
| `report` (Json) | `result.report` (validated `FitReport`) |
| `audienceSummary` (Json) | `result.evidence.audienceDistribution` |
| `confidence` (Json) | `{ level: report.confidence }` |
| `sampleSize` (Json) | compact `{ kolPosts, kolReplies, topPostsAnalyzed, engagedAccounts, websiteStatus, docsStatus }` |
| `reportSchemaVersion` | `report.schemaVersion` |
| `llmModel` | `result.llmModel` |
| `promptVersion` | `null` (mock uses no prompt) |
| `generatedAt` | `now()` |

- **Idempotency preserved:** the single `prisma.report.upsert({ where: { requestId }, … })` (unique `requestId`) is unchanged in shape — retries update the one row, never duplicate.
- The optional normalized tables `ReportEvidence` / `EngagedAccountSample` are **not** written this unit (evidence lives in the JSON columns + `FitReport.evidence`); populating them is deferred to avoid child-row upsert complexity. This needs no schema change.

**Why no Prisma schema change is required:** every field above already exists on `Report` (columns `scores`, `audienceSummary`, `confidence`, `sampleSize`, `reportSchemaVersion`, `llmModel`, `report`, `overallScore`, `verdict`, `generatedAt` are all present from Unit 03). So the schema is untouched.

## Worker Integration Behavior

- `apps/worker/src/handlers/analysis-run.ts`:
  - **Preserve** the Unit 07 transitions exactly: payload validate → load job+request → guards (missing / requestId mismatch / already-`COMPLETED` short-circuit) → `QUEUED → RUNNING` → build → upsert → `RUNNING → COMPLETED`; on any throw → `RUNNING → FAILED` with `errorCode: "worker_error"` + sanitized message (unchanged).
  - **Replace** the `buildPlaceholderReport()` call with: map `job.request` → `AnalysisRequestData`, `const result = await runAnalysis(requestData)` (default options → mock providers, `performWebIngestion` false), then map `result` → the report fields table above.
  - **Delete** `apps/worker/src/placeholder-report.ts` and its import (report-building now lives solely in the pipeline — no duplication).
- The worker still boots/handles missing-DB, idempotency, and not-found cases exactly as before.

## Error Handling

- **Graceful degradation inside the pipeline** (Invariant 8): null profiles, empty post/engagement sets, and failed/skipped ingestion all continue with reduced data and `confidence: "low"` — they do not throw.
- **Hard failures** (e.g. a provider unexpectedly throws, or the assembled report fails `FitReportSchema.parse`) propagate out of `runAnalysis`; the worker's existing `try/catch` records the job `FAILED` (preserved). The pipeline never persists — persistence is worker-only, after a valid result.
- Final `FitReport` is validated with `FitReportSchema` before it leaves the pipeline (Invariant 12) — invalid structured output is a failure, never a saved report.
- No secrets/stack traces in stored messages (unchanged worker behavior).

## Implementation Steps

1. **Deps:** `packages/analysis` += `@kol-fit/shared`, `@kol-fit/twitter`, `@kol-fit/llm` (all `workspace:*`). `apps/worker` += `@kol-fit/analysis`.
2. `packages/analysis/src/pipeline/types.ts` — the types above.
3. `select-posts.ts` — deterministic `selectTopPosts(posts, limit)`.
4. `collect-engagement.ts` — `collectEngagedAccounts(perPostResults, maxUnique)` (dedupe by `user.id`, cap).
5. `placeholder-scores.ts` — `buildPlaceholderScores()`.
6. `run-analysis.ts` — `runAnalysis(request, options)` orchestration + evidence assembly + `FitReportSchema` validation.
7. `packages/analysis/src/index.ts` — export `runAnalysis` + pipeline types (keep the Unit 12 ingestion exports).
8. `apps/worker` — rewrite the build+persist section of `analysis-run.ts` to call `runAnalysis` and map `AnalysisResult`; delete `placeholder-report.ts`.
9. Confirm **no** changes to `packages/db/prisma/schema.prisma`, API routes, or UI.

## Dependencies

- `packages/analysis`: new workspace deps `@kol-fit/shared`, `@kol-fit/twitter`, `@kol-fit/llm`. No new npm packages. (`@types/node` already present.)
- `apps/worker`: new workspace dep `@kol-fit/analysis`. No new npm packages.
- No live-network / SDK deps.

## Verification Checklist

Primary verification is **offline and disk-light** (`pnpm build` + `node -e` against built packages, mock providers, injected fetch). One **small online** worker E2E uses a throwaway local Postgres (initdb ≈ tens of MB — mind the earlier low-disk note; tear it down after).

Offline — pipeline:
- [ ] `pnpm build` passes across all workspace projects.
- [ ] `runAnalysis(request)` (default mock providers) returns a `result.report` that validates against `FitReportSchema`.
- [ ] **Evidence complete:** `result.evidence` has org/KOL handles, `kolPostsSampled > 0`, `engagedAccountsSampled > 0`, `audienceDistribution` spanning multiple buckets, `websiteStatus`/`docsStatus` (`"skipped"` by default), `twitterProviderKind`/`llmProviderKind` = `"mock"`, non-empty `llmModel`, and a `confidence`. `FitReport.evidence.sampleSizes` matches (kolPosts/engagedAccounts/topPostsAnalyzed).
- [ ] **Placeholder scoring marked:** `result.scores` validates `ScoreBreakdownSchema` with `overall.value === 0` / `confidence "low"` and placeholder reasons; `FitReport.evidence.notes` contains the "SCORES ARE PLACEHOLDERS … Unit 14" banner; `report.overallScore.value === 0`, `verdict === "OKAY"`.
- [ ] **Caps respected:** `kolPostsSampled ≤ caps.kolPostsFetched`, `topPostsAnalyzed ≤ caps.topPostsForDeepAnalysis`, `engagedAccountsSampled ≤ caps.maxUniqueEngagedAccounts`; engaged accounts are deduped by `user.id`.
- [ ] **Determinism:** two runs with the same request + mock providers are deep-equal.
- [ ] **Manual brief:** a request with `productCategory` set surfaces verbatim in the report's org classification.
- [ ] **Ingestion integration:** with `performWebIngestion: true` + an injected `fetchImpl` returning HTML, `websiteStatus === "fetched"` and a note reflects it; default (false) → `"skipped"` and the injected fetch is **not** called.
- [ ] **Provider decoupling:** `runAnalysis` works with explicitly injected `twitter`/`llm` providers (no direct `Mock*` import in `run-analysis.ts` — grep).

Worker integration:
- [ ] `buildPlaceholderReport` and `apps/worker/src/placeholder-report.ts` are gone; the worker imports `runAnalysis` (grep confirms no lingering reference).
- [ ] Offline: worker still boots and exits cleanly with no DB (unchanged Unit 07 behavior).
- [ ] Online (throwaway Postgres): POST → job `QUEUED → RUNNING → COMPLETED`; exactly one `Report` row with `status COMPLETED`, `report` validating `FitReportSchema`, and `scores` / `audienceSummary` / `sampleSize` / `overallScore` / `verdict` / `confidence` / `reportSchemaVersion` / `llmModel` all populated; **idempotency** — re-enqueue the same payload → still one report, "already completed" skip.

Scope guardrails:
- [ ] `git diff packages/db/prisma/schema.prisma` is empty (no schema change); no API-route or UI changes.
- [ ] Provider-specific logic stays in `packages/twitter` / `packages/llm`; the pipeline depends only on interfaces/factories + shared schemas.
- [ ] `context/progress-tracker.md` updated once implemented.
- [ ] No commits made.
```
