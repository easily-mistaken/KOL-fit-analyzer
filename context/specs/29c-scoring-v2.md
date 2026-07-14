# Unit 29C: Scoring v2 (calibration curves, baseline-adjusted risks, semantic fit)

Part of the Unit 29 accuracy overhaul (`29-analysis-accuracy-overhaul.md`).
Goal: fix the v1 harshness/senselessness the user reported by replacing
raw-share scoring with calibrated curves, consuming the 29A/29B evidence.
All 9 `ScoreMetric` slugs are KEPT; only computation changes. Every constant
lives in `weights.ts` for 29E calibration against ground-truth pairs.
Benchmark: Uniswap × haydenzadams (v1: 40/WEAK) must land STRONG.

## Scoring changes (packages/scoring)

- **`curve(x, anchors)`**: piecewise-linear interpolation; anchor tables in
  `weights.ts` (`EAM_ANCHORS`, `CF_ANCHORS`, `PROMO_ANCHORS`,
  `BOT_RISK_ANCHORS`, `GEO_ANCHORS`).
- **EAM v2**: targets from `org.targetBuckets` (29B; primary weight 1.0,
  secondary 0.5; fallback = legacy keyword derivation, all-primary). Computed
  over HUMAN accounts only (bucket ∉ {bots_spam, giveaway_hunters}) — junk's
  harm lives in AQ/BFR, ending the triple-punishment. Source-weighted
  (reply/quote 1.0, retweet 0.5). `EAM = curve(matchedShare)` — 30% share ≈
  75, 45% ≈ 88 (real engaged audiences are heterogeneous).
- **AQ v2 (baseline-adjusted)**: `lowQ = bots + giveaway + 0.6·farmers`;
  `AQ = 100 − AQ_SLOPE·max(0, lowQ − LOWQ_BASELINE) + repeatBonus` — the
  first `LOWQ_BASELINE` (10%) junk is free (endemic on crypto Twitter);
  repeat engagers (29A `appearances`) add up to +8. Null `botScore` excluded
  from averages (missing data no longer deflates risk).
- **Bot/farm risk v2**: `fakeShare = bots + giveaway + 0.5·farmers`;
  `risk = curve(max(0, fakeShare − baseline)) + avgBot excess nudge`.
- **Paid-promo risk v2 (saturation, not presence)**: from 29B `postLabels` —
  `saturation = promoPosts/labeled`, `unrelatedShare`, `lowQualityShare`;
  `risk = curve(saturation) × (0.4 + 0.6·max(unrelated, lowQuality))` — a
  KOL doing related, decent promos runs at 0.4× (normal business). Fallback
  when postLabels absent: legacy pattern heuristic, capped at 60, low conf.
- **Brand safety v2**: from 29B `brandSafetyFlags` only — `100 − Σ(high 35,
  medium 15, low 5)`, floor 0; no flags → 100. Promo leakage and the meme
  penalty are GONE.
- **Content fit v2**: from the 29B `ContentFitAssessment` rubric —
  `curve(0.3·adjacency + 0.4·overlap + 0.3·natural)` where 3/5 ≈ 70
  (adjacent domains count). `CONTENT_FIT_CAP` retired. Fallback when the
  assessment is absent: legacy token overlap.
- **Campaign-goal fit v2**: goal string normalized (lowercase, spaces/dashes
  → underscores, contains-match) so LLM-inferred "developer adoption"
  matches; measured human-weighted like EAM over union(goal buckets,
  org primary targets); goal absent → EAM proxy (unchanged).
- **Geo/language v2**: deterministic from `Tweet.lang` — region unset/global
  → 85 (medium when langs present); region set → expected-language share via
  a small region→lang table through `GEO_ANCHORS`; no lang data → legacy
  stub (low confidence).
- **Weights v2**: EAM .40, AQ .15, CF .15, CGF .15, BS .10, GLF .05.
- **Verdict gates v2** (bots are inevitable; promo is a business model):
  bot risk ≥ 95 → cap WEAK; ≥ 85 → cap OKAY. Promo gate only when risk ≥ 85
  AND unrelatedShare > 0.5 → cap OKAY. The blunt 70→WEAK gate is gone.
  Thresholds 80/65/50/35 unchanged (harshness fixed upstream).
- **Confidence v2**: keys off `engagedAccountsClassified` (≥100→2, ≥30→1) +
  posts (≥10→2, ≥3→1) + website/docs (+1) + engagement text present (+1);
  ≥5 high, ≥3 medium.

## Input plumbing

`ScoringSampleMeta` += `engagedAccountsClassified?`, `repeatEngagerShare?`;
`ScoringEvidence` += `hasEngagementText?`; `ScoringInput` +=
`contentFitAssessment?: ContentFitAssessment`, `kolPostLangs?: string[]`.

Pipeline (`run-analysis.ts`): calls `llm.assessContentFit` (in parallel with
audience classification; a failure degrades to the token-overlap fallback
instead of failing the analysis) and threads the new sample/evidence fields.
UI metric explainers (`apps/web/lib/metric-info.ts`) updated to v2 semantics.

## Verification

`pnpm build`; new `scripts/checks/scoring-v2.regression.cjs` in `pnpm check`
(curve math, human-only EAM + fallbacks, baselines, saturation promo +
gates, flags-based brand safety, rubric content fit, geo table, confidence,
determinism, **a Uniswap-shaped fixture scoring STRONG**); mock pipeline E2E.
