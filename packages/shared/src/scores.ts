import { z } from "zod";

// The 9 score metrics. Note: for the risk metrics (paid_promo_risk,
// bot_farm_risk) a HIGHER value means MORE risk. Numeric weights are NOT
// defined here — they live in packages/scoring (Unit 14).
export const ScoreMetricSchema = z.enum([
  "overall_fit",
  "content_fit",
  "engaged_audience_match",
  "audience_quality",
  "campaign_goal_fit",
  "geo_language_fit",
  "brand_safety",
  "paid_promo_risk",
  "bot_farm_risk",
]);
export type ScoreMetric = z.infer<typeof ScoreMetricSchema>;

export const ConfidenceLevelSchema = z.enum(["low", "medium", "high"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

// A single score: 0-100 integer plus its confidence and the evidence signals
// that produced it (code-standards.md -> Scoring output).
export const ScoreValueSchema = z.object({
  value: z.number().int().min(0).max(100),
  confidence: ConfidenceLevelSchema,
  reasons: z.array(z.string()).default([]),
});
export type ScoreValue = z.infer<typeof ScoreValueSchema>;

// Deterministic score breakdown. Matches the Report.scores JSON column.
// components is a partial record so a report can omit metrics it could not
// compute (missing data lowers confidence rather than breaking — Invariant 8).
export const ScoreBreakdownSchema = z.object({
  overall: ScoreValueSchema,
  components: z.partialRecord(ScoreMetricSchema, ScoreValueSchema),
  confidence: ConfidenceLevelSchema,
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;
