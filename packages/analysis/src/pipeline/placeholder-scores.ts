import {
  ScoreBreakdownSchema,
  type ScoreBreakdown,
  type ScoreMetric,
  type ScoreValue,
} from "@kol-fit/shared";

const METRICS: ScoreMetric[] = [
  "overall_fit",
  "content_fit",
  "engaged_audience_match",
  "audience_quality",
  "campaign_goal_fit",
  "geo_language_fit",
  "brand_safety",
  "paid_promo_risk",
  "bot_farm_risk",
];

const placeholder = (metric: ScoreMetric): ScoreValue => ({
  value: 0,
  confidence: "low",
  reasons: [`Placeholder for ${metric}; deterministic scoring lands in Unit 14.`],
});

/**
 * The single seam Unit 14 replaces with real deterministic scoring
 * (packages/scoring). Until then, every metric is a clearly-marked placeholder
 * (0 / low). Validated against ScoreBreakdownSchema.
 */
export function buildPlaceholderScores(): ScoreBreakdown {
  const components: Partial<Record<ScoreMetric, ScoreValue>> = {};
  for (const m of METRICS) components[m] = placeholder(m);

  return ScoreBreakdownSchema.parse({
    overall: placeholder("overall_fit"),
    components,
    confidence: "low",
  });
}
