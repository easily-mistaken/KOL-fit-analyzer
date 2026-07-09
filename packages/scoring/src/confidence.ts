import type { ConfidenceLevel } from "@kol-fit/shared";

import type { ScoringEvidence, ScoringSampleMeta } from "./types.js";

const ORDER: ConfidenceLevel[] = ["low", "medium", "high"];

/** The lower of two confidence levels. */
export function minConfidence(
  a: ConfidenceLevel,
  b: ConfidenceLevel
): ConfidenceLevel {
  return ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b;
}

/**
 * Deterministic confidence from sample sizes + ingestion evidence. Full mock
 * fixtures land at medium/high; missing data degrades to low (Invariant 8).
 */
export function confidenceFromEvidence(
  sample: ScoringSampleMeta,
  evidence: ScoringEvidence
): ConfidenceLevel {
  let points = 0;
  if (sample.engagedAccountsSampled >= 50) points += 2;
  else if (sample.engagedAccountsSampled >= 10) points += 1;
  if (sample.kolPostsSampled >= 10) points += 2;
  else if (sample.kolPostsSampled >= 3) points += 1;
  if (evidence.websiteFetched || evidence.docsFetched) points += 1;

  if (points >= 4) return "high";
  if (points >= 2) return "medium";
  return "low";
}
