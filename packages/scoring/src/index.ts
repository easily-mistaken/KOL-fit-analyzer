// Public surface of @kol-fit/scoring: deterministic, explainable scoring. All
// numeric scoring lives here — the LLM never computes scores.
export { scoreAnalysis } from "./score.js";
export {
  verdictFromScore,
  riskGateApplied,
  type RiskGateInput,
} from "./verdict.js";
export { confidenceFromEvidence } from "./confidence.js";
export {
  curve,
  expectedReach,
  geoTiltFactor,
  regionDistribution,
} from "./metrics.js";
export {
  VERDICT_THRESHOLDS,
  EAM_ANCHORS,
  CF_ANCHORS,
  PROMO_ANCHORS,
  BOT_RISK_ANCHORS,
  GEO_ANCHORS,
  LOWQ_BASELINE,
  BOT_GATE_OKAY,
  BOT_GATE_WEAK,
  BOT_GATE_AVOID,
  PROMO_GATE_OKAY,
  PROMO_GATE_WEAK,
  PROMO_GATE_UNRELATED_SHARE,
  BRAND_GATE_WEAK,
  BRAND_GATE_AVOID,
  BRAND_SAFETY_DEDUCTIONS,
} from "./weights.js";
export type {
  ScoringInput,
  ScoringResult,
  ScoringSampleMeta,
  ScoringEvidence,
  ScoringBrief,
} from "./types.js";
