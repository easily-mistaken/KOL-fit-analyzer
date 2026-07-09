# Unit 14: Deterministic Scoring Module

## Goal

Implement real, deterministic, explainable scoring in `packages/scoring` and use it to replace Unit 13's `buildPlaceholderScores()` **and** the hardcoded `verdict = "OKAY"`. The module consumes the pipeline's structured (LLM/mock) classifications + evidence and computes the 9 `ScoreMetric`s, an overall fit score, a `ReportVerdict`, and a confidence level — each with human-readable reasons. Numbers are computed here, never by the LLM.

Same input → same output. Still driven by mock data, but the scoring contract is shaped for live data later.

Explicit non-goals (later units / never):

- **No LLM-computed numbers.** The LLM produces qualitative classifications; all arithmetic lives in `packages/scoring`. `generateFitReport` receives the finished scores as input (Invariant: LLM never invents scores).
- No live TwitterAPI.io (Unit 16), no OpenAI (Unit 17), no caching/cost controls.
- No API-route or UI change; **no Prisma schema change** (the `Report.scores` column already stores a `ScoreBreakdown`).
- No commits.

### Alignment with the Unit 13 review findings

- Replaces **both** `buildPlaceholderScores()` and `verdict = "OKAY"`. ✅
- Scoring returns **both** `ScoreBreakdown` **and** `ReportVerdict` (verdict derived from overall via a defined mapping). ✅
- The "SCORES ARE PLACEHOLDERS … Unit 14" banner note is **removed**. ✅
- Scoring input types are defined **in `packages/scoring`** (composed from shared provider-neutral types), not imported from `packages/analysis`. ✅
- `packages/scoring` stays **independent of `packages/analysis`** (analysis depends on scoring, never the reverse; the ingestion status is passed as plain booleans, not the analysis `SourceStatus` type). ✅
- Provider-kind metadata dedup and the compact status-page note are **out of scope** (Units 15/16/17). ✅

## Scoring Architecture

Pure, dependency-light functions in `packages/scoring/src/`:

```
packages/scoring/src/
  types.ts        # ScoringInput, ScoringResult (defined here; reuse shared value types)
  weights.ts      # locked overall weights + verdict thresholds + tuning constants
  metrics.ts      # one pure fn per metric -> ScoreValue (value/confidence/reasons)
  verdict.ts      # verdictFromScore(overall, risks) -> ReportVerdict (+ risk gate)
  confidence.ts   # confidenceFromEvidence(sample, ingestion) -> ConfidenceLevel
  score.ts        # scoreAnalysis(input): ScoringResult  (orchestrates + validates)
  index.ts        # barrel
```

- Deterministic: no `Math.random`, no `Date.now`, no I/O, no env. Every metric is a pure function of the input.
- All numeric outputs are integers in `[0,100]` (compute in float, `Math.round`, clamp).
- `scoreAnalysis` validates its output with `ScoreBreakdownSchema` before returning (Invariant 12).

## Input / Output Design

Types live in `packages/scoring` (composed from shared value types — no `packages/analysis` import):

```ts
import type {
  OrgClassification, KolContentClassification, AudienceClassification,
  ScoreBreakdown, ReportVerdict,
} from "@kol-fit/shared";

export type ScoringSampleMeta = {
  kolPostsSampled: number;
  kolRepliesSampled: number;
  topPostsAnalyzed: number;
  engagedAccountsSampled: number;
};

// Provider-neutral evidence booleans (pipeline maps its SourceStatus -> fetched?).
export type ScoringEvidence = {
  websiteFetched: boolean;
  docsFetched: boolean;
};

export type ScoringBrief = {
  campaignGoal?: string | null;   // free text or a CampaignGoal value
  region?: string | null;
  productCategory?: string | null;
  targetUser?: string | null;
  stage?: string | null;
};

export type ScoringInput = {
  org: OrgClassification;
  content: KolContentClassification;
  audience: AudienceClassification;   // accounts[] + distribution
  sample: ScoringSampleMeta;
  evidence: ScoringEvidence;
  brief: ScoringBrief;
};

export type ScoringResult = {
  scores: ScoreBreakdown;   // overall (=overall_fit) + components(8) + confidence
  verdict: ReportVerdict;
};

export function scoreAnalysis(input: ScoringInput): ScoringResult;
```

- `scores.overall` = the `overall_fit` `ScoreValue`; `scores.components` holds the **other 8** metrics (`content_fit`, `engaged_audience_match`, `audience_quality`, `campaign_goal_fit`, `geo_language_fit`, `brand_safety`, `paid_promo_risk`, `bot_farm_risk`); `scores.confidence` = overall confidence. (Note: this differs from Unit 13's placeholder, which stuffed all 9 into `components`.)
- Also export `verdictFromScore`, `OVERALL_WEIGHTS`, and `VERDICT_THRESHOLDS` for testing/transparency.

## Score Metric Definitions

All metrics are 0–100 integers with `reasons`. **Risk-metric direction is explicit: for `paid_promo_risk` and `bot_farm_risk`, HIGHER = MORE RISK (worse).** The other seven are "higher = better fit/quality".

Shorthand: `share(bucket)` = `distribution.buckets[bucket]?.share ?? 0`; `avgBotScore` = mean of `account.signals.botScore` over classified accounts (0 when none).

1. **engaged_audience_match (core, 35%)** — how much of the *engaged* audience matches the org's target. Derive **target buckets** deterministically from the brief/org: `campaignGoal` → buckets (table in Weighting/Goal section), plus keyword hits over `productCategory` + `targetUser` + `org.keywords` (e.g. perps/trading→`traders`, defi/yield/lending→`defi_users`, dev/sdk/infra→`developers`+`infra_research`, nft/gaming→`nft_gaming`, ai→`ai_crypto`, founder→`founders`, investor→`investors_vcs`). If none derived → a generic "real crypto audience" set (all buckets except `bots_spam`, `giveaway_hunters`, `non_crypto`). Score = `clamp(round(100 * Σ share(targetBucket)))`. Reasons list the target buckets + matched share. This is the product's core signal.
2. **audience_quality (20%)** — share of real vs low-quality accounts. `penalty = 100*share(bots_spam) + 100*share(giveaway_hunters) + 60*share(airdrop_farmers) + 20*avgBotScore`; score = `clamp(round(100 - penalty))`. Reasons cite the low-quality shares.
3. **content_fit (15%, capped so it can't dominate)** — overlap of KOL content with the org domain. Compare `content.verticals ∪ tokenized(content.themes)` against `tokenized(productCategory) ∪ org.keywords ∪ targetBucketDomains`. Score = `clamp(round(100 * matches / max(1, expected)))`, then **capped at 90** so strong topical overlap alone never produces a top score. Reasons list matched verticals/themes.
4. **campaign_goal_fit (15%)** — how well the audience serves the goal (goal→buckets table). Score = `clamp(round(100 * Σ share(goalBucket)))`; when goal is unknown/absent → falls back to `engaged_audience_match` value (neutral). Reasons name the goal + supporting buckets.
5. **geo_language_fit (5%)** — org region vs audience language. Mock geo signal is weak, so: region empty/"global"/"english" → 80; otherwise 70 (assume English default). Always emitted with **low** confidence + a reason noting limited geo signal in mock data. (Structured for real lang/geo data later.)
6. **brand_safety (10%)** — content brand risk. `penalty = 0.7*paid_promo_risk + 15*(share(meme_degens) > 0.4 ? 1 : 0)`; score = `clamp(round(100 - penalty))`. Reasons cite promo patterns / meme skew.
7. **paid_promo_risk (HIGHER = WORSE)** — from content signals. `risk = clamp(round(15*content.promoPatterns.length + (content.repeatedTickers.length >= 3 ? 20 : 0)))`. Reasons list the promo patterns / ticker count.
8. **bot_farm_risk (HIGHER = WORSE)** — from audience signals. `risk = clamp(round(100*share(bots_spam) + 100*share(giveaway_hunters) + 70*share(airdrop_farmers) + 30*avgBotScore))`. Reasons cite the offending shares. (Note: `audience_quality ≈ 100 − this penalty` — the two are complementary views of the same signal, documented as such.)
9. **overall_fit** — the weighted composite (below).

## Weighting Model

Locked overall weights (sum = 1.00), living in `packages/scoring/src/weights.ts` (weights belong to scoring, not `@kol-fit/shared`):

| Metric | Weight |
| --- | --- |
| engaged_audience_match | 0.35 |
| audience_quality | 0.20 |
| content_fit | 0.15 |
| campaign_goal_fit | 0.15 |
| brand_safety | 0.10 |
| geo_language_fit | 0.05 |

`overall_fit = clamp(round(0.35·EAM + 0.20·AQ + 0.15·CF + 0.15·CGF + 0.10·BS + 0.05·GLF))`.

- **engaged_audience_match is the dominant term (35%)** and `content_fit` is deliberately minor (15%, capped at 90) so topical overlap can't carry a bad-audience match — the product's core metric wins.
- The two **risk** metrics are **not** direct terms in the composite; they act through the metrics they feed (`bot_farm_risk` → `audience_quality`; `paid_promo_risk` → `brand_safety`) and through the verdict risk gate below. This keeps the locked weights intact while risk still moves the outcome.

Goal → buckets (for `campaign_goal_fit`, and augmenting target buckets):

| campaignGoal | supporting buckets |
| --- | --- |
| developer_adoption | developers, infra_research |
| investor_credibility | investors_vcs, founders |
| user_acquisition | defi_users, traders, nft_gaming, ai_crypto |
| token_launch_visibility | traders, meme_degens, kols_creators |
| community_growth | community_managers, kols_creators, developers, defi_users |
| awareness | all except bots_spam, giveaway_hunters, non_crypto |

Unknown/free-text goals map by keyword where possible, else fall back as noted per metric.

## Verdict Mapping

`verdictFromScore(overall, { paidPromoRisk, botFarmRisk })` in `verdict.ts`:

| overall_fit | verdict |
| --- | --- |
| ≥ 80 | STRONG |
| 65–79 | GOOD |
| 50–64 | OKAY |
| 35–49 | WEAK |
| < 35 | AVOID |

**Risk gate (explicit):** if `botFarmRisk ≥ 70` or `paidPromoRisk ≥ 70`, the verdict is capped at **WEAK** (it may still be AVOID, but never OKAY/GOOD/STRONG) regardless of overall — a high-risk audience/content can't earn a positive verdict. The applied cap is recorded in the overall reasons.

## Evidence / Reason Generation

- Every `ScoreValue.reasons` is a non-empty array of short, concrete strings derived from the actual inputs (e.g. `"62% of engaged audience in target buckets: defi_users, traders"`, `"18% airdrop farmers, 4% bots → quality penalty"`, `"2 promo patterns detected in content"`, `"verdict capped at WEAK: bot/farm risk 74"`). No magic numbers without an explanation.
- `overall_fit.reasons` summarize the weighted contributors (top drivers) and any risk-gate application, so the headline number is explainable at a glance (Unit 15 renders these).

## Confidence Calculation

`confidenceFromEvidence(sample, evidence)` in `confidence.ts`, deterministic:

- `points = 0`; `engagedAccountsSampled ≥ 50 → +2` (else `≥ 10 → +1`); `kolPostsSampled ≥ 10 → +2` (else `≥ 3 → +1`); `(websiteFetched || docsFetched) → +1`.
- `points ≥ 4 → "high"`, `≥ 2 → "medium"`, else `"low"`.
- **Per-metric confidence:** audience metrics (`engaged_audience_match`, `audience_quality`, `bot_farm_risk`) use the sample-size-derived level; content metrics (`content_fit`, `paid_promo_risk`, `brand_safety`) use `min(sampleLevel, "medium")` unless content is empty (→ low); `geo_language_fit` is always `"low"` (weak mock signal). `scores.confidence` (overall) = the evidence-derived level, and `overall_fit.confidence` mirrors it.
- With full mock fixtures this yields **medium/high**; with empty audience / missing profiles / skipped ingestion it degrades to **low** (Invariant 8).

## Integration Behavior with the Unit 13 Pipeline

In `packages/analysis/src/pipeline/run-analysis.ts`:

1. Build a `ScoringInput` from data already in hand: `org` = `orgClassification`, `content` = `kolContent`, `audience` = `audience`, `sample` = the counts already computed, `evidence` = `{ websiteFetched: orgContext.website.status === "fetched", docsFetched: orgContext.docs.status === "fetched" }`, `brief` = the request's `campaignGoal`/`region`/`productCategory`/`targetUser`/`stage`.
2. `const { scores, verdict } = scoreAnalysis(scoringInput);` — replacing `buildPlaceholderScores()` and `verdict = "OKAY"`.
3. Pass the **real** `scores` + `verdict` into `llm.generateFitReport({ …, scores, verdict, sampleSizes })` exactly as before. The mock places them through — so the `FitReport`'s `overallScore`/`verdict`/section scores/`confidence` now reflect deterministic scoring, with the LLM still only writing narrative.
4. `AnalysisResult.scores` = the real `ScoreBreakdown`; `evidence.confidence` = `scores.confidence` (already sourced from `report.confidence`).

Everything downstream (worker mapping to `Report.overallScore`/`verdict`/`scores`/`confidence`/`audienceSummary`/`sampleSize`, upsert idempotency, transitions) is **unchanged** — only the values differ. No schema change (the `scores` column already holds a `ScoreBreakdown`).

## Placeholder-Score Removal Plan

- Delete `packages/analysis/src/pipeline/placeholder-scores.ts` and remove `buildPlaceholderScores` from the analysis barrel (`packages/analysis/src/index.ts`).
- In `run-analysis.ts`: drop the `buildPlaceholderScores`/`verdict="OKAY"` lines and the **"SCORES ARE PLACEHOLDERS — … Unit 14"** evidence note. The provider/ingestion notes stay; optionally add a concise `"Deterministic scoring v1 (engaged-audience-match weighted)."` note (not required).
- `packages/analysis` gains a `@kol-fit/scoring` dependency.
- No remaining reference to `buildPlaceholderScores` anywhere (grep-verified).

## Error Handling

- Scoring is pure and total: it never throws for structurally valid inputs. Edge cases degrade gracefully (Invariant 8): `distribution.sampleSize === 0` → audience metrics 0 with **low** confidence (no divide-by-zero — guard shares); missing org fields → generic target buckets + lower confidence; empty content → content metrics low.
- `scoreAnalysis` runs `ScoreBreakdownSchema.parse` on its result; a parse failure indicates an internal bug and propagates so the pipeline/worker records the job `FAILED` (existing behavior) rather than persisting bad scores.
- No secrets/PII in reasons (only handles/buckets/aggregate stats).

## Implementation Steps

1. **Deps:** `packages/scoring` += `@kol-fit/shared` (`workspace:*`). `packages/analysis` += `@kol-fit/scoring` (`workspace:*`). No new npm packages; no `@types/node` (pure, no env).
2. `packages/scoring/src/weights.ts` — `OVERALL_WEIGHTS`, `VERDICT_THRESHOLDS`, goal→bucket map, tuning constants.
3. `types.ts` — the input/output types above.
4. `metrics.ts` — a pure function per metric returning `ScoreValue` (value + confidence + reasons); shared helpers (`share`, `avgBotScore`, target-bucket derivation, keyword tokenizer).
5. `verdict.ts` — `verdictFromScore` + risk gate. `confidence.ts` — `confidenceFromEvidence`.
6. `score.ts` — `scoreAnalysis(input)`: compute risks → components → overall → verdict → confidence, assemble `ScoreBreakdown`, `ScoreBreakdownSchema.parse`, return `{ scores, verdict }`.
7. `index.ts` — export `scoreAnalysis`, `verdictFromScore`, `OVERALL_WEIGHTS`, `VERDICT_THRESHOLDS`, and the types. Replace the `PACKAGE_NAME` placeholder.
8. `packages/analysis/src/pipeline/run-analysis.ts` — wire `scoreAnalysis`; delete `placeholder-scores.ts`; remove the placeholder banner note; update the barrel.
9. Confirm **no** changes to `packages/db/prisma/schema.prisma`, API routes, or UI.

## Dependencies

- `packages/scoring`: new workspace dep `@kol-fit/shared`. Pure module — no `@types/node`, no runtime npm deps.
- `packages/analysis`: new workspace dep `@kol-fit/scoring`.
- No live-network / SDK deps.

## Verification Checklist

Primary verification is **offline and disk-light** (`pnpm build` + `node -e` against built packages). One optional small online worker check re-confirms persistence wiring (throwaway Postgres; mind the low-disk note; tear down).

Offline — scoring unit:
- [ ] `pnpm build` passes across all workspace projects.
- [ ] `scoreAnalysis(input)` returns `scores` validating `ScoreBreakdownSchema` and a `verdict` in the `ReportVerdict` enum; `components` holds the 8 non-overall metrics; every `ScoreValue.reasons` is non-empty.
- [ ] **Weights arithmetic:** for an input with known component values, `overall_fit` equals `round(0.35·EAM + 0.20·AQ + 0.15·CF + 0.15·CGF + 0.10·BS + 0.05·GLF)`.
- [ ] **Core metric dominates:** raising `engaged_audience_match` inputs moves `overall` ~2.3× more than the same raise to `content_fit`; content fit alone never yields a STRONG verdict.
- [ ] **Risk direction:** a bot/farmer-heavy distribution → high `bot_farm_risk` **and** low `audience_quality`; promo-pattern-heavy content → high `paid_promo_risk` **and** low `brand_safety`.
- [ ] **Verdict mapping:** `verdictFromScore` returns STRONG/GOOD/OKAY/WEAK/AVOID at the documented thresholds; the **risk gate** caps verdict at WEAK when `bot_farm_risk ≥ 70` or `paid_promo_risk ≥ 70` (with a reason recorded).
- [ ] **Confidence:** large samples → medium/high; empty audience / tiny samples / no ingestion → low; `geo_language_fit` always low.
- [ ] **Determinism:** identical input twice → deep-equal result. **Edge:** empty audience (`sampleSize 0`) does not throw.

Offline — pipeline integration:
- [ ] `runAnalysis(request)` (mock providers) now returns **real** scores: `result.scores` reasons contain **no** "Unit 14 placeholder" text; `result.report` has **no** "SCORES ARE PLACEHOLDERS" note; `report.verdict === verdictFromScore(report.overallScore.value, risks)`; `report.overallScore.value` is the weighted composite (not a hardcoded 0/OKAY unless the data truly scores that way).
- [ ] `packages/analysis/src/pipeline/placeholder-scores.ts` is gone and no `buildPlaceholderScores` reference remains (grep). Pipeline still validates the final `FitReport`; determinism holds.

Optional online (disk-light): POST-equivalent → worker → one `Report` with real `scores`/`verdict`/`confidence`/`overallScore` persisted and `FitReportSchema`-valid; idempotency preserved (re-enqueue → still one report).

Scope guardrails:
- [ ] `git diff packages/db/prisma/schema.prisma` empty; no API-route or UI changes.
- [ ] `packages/scoring` does not import `packages/analysis`; the LLM package computes no scores (scoring is fully separate).
- [ ] `context/progress-tracker.md` updated once implemented.
- [ ] No commits made.
```
