// Public surface of @kol-fit/scoring: deterministic, explainable scoring. All
// numeric scoring lives here — the LLM never computes scores.
export { scoreAnalysis } from "./score.js";
export { verdictFromScore, riskGateApplied } from "./verdict.js";
export { confidenceFromEvidence } from "./confidence.js";
export {
  OVERALL_WEIGHTS,
  VERDICT_THRESHOLDS,
  RISK_GATE_THRESHOLD,
  CONTENT_FIT_CAP,
} from "./weights.js";
export type {
  ScoringInput,
  ScoringResult,
  ScoringSampleMeta,
  ScoringEvidence,
  ScoringBrief,
} from "./types.js";
