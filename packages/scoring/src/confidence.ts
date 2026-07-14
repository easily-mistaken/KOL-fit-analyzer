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
 * Deterministic confidence from sample sizes + evidence (v2, Unit 29C).
 * Keys off the LLM-CLASSIFIED engaged-account count when recorded (the
 * classification cap means classified < sampled on live runs), plus post
 * sample depth, web ingestion, and whether reply/quote text was available
 * (29A) — text makes audience classification materially more reliable.
 * Missing data degrades to low (Invariant 8).
 */
export function confidenceFromEvidence(
  sample: ScoringSampleMeta,
  evidence: ScoringEvidence
): ConfidenceLevel {
  const classified =
    sample.engagedAccountsClassified ?? sample.engagedAccountsSampled;
  let points = 0;
  if (classified >= 100) points += 2;
  else if (classified >= 30) points += 1;
  if (sample.kolPostsSampled >= 10) points += 2;
  else if (sample.kolPostsSampled >= 3) points += 1;
  if (evidence.websiteFetched || evidence.docsFetched) points += 1;
  if (evidence.hasEngagementText) points += 1;

  if (points >= 5) return "high";
  if (points >= 3) return "medium";
  return "low";
}
