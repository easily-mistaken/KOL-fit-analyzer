import {
  ScoreBreakdownSchema,
  type ScoreMetric,
  type ScoreValue,
} from "@kol-fit/shared";

import { confidenceFromEvidence } from "./confidence.js";
import {
  audienceQuality,
  avgBotScore,
  botFarmRisk,
  brandSafety,
  campaignGoalFit,
  clampRound,
  contentFit,
  deriveTargetBuckets,
  engagedAudienceMatch,
  geoLanguageFit,
  paidPromoRisk,
  resolveGoal,
} from "./metrics.js";
import type { ScoringInput, ScoringResult } from "./types.js";
import { riskGateApplied, verdictFromScore } from "./verdict.js";
import { OVERALL_WEIGHTS } from "./weights.js";

const METRIC_LABELS: Record<keyof typeof OVERALL_WEIGHTS, string> = {
  engaged_audience_match: "engaged audience match",
  audience_quality: "audience quality",
  content_fit: "content fit",
  campaign_goal_fit: "campaign goal fit",
  brand_safety: "brand safety",
  geo_language_fit: "geo/language fit",
};

/**
 * Deterministic, explainable scoring. Computes the 9 metrics, the weighted
 * overall, a verdict (with risk gate), and confidence — all from the pipeline's
 * structured classifications/evidence. Numbers are computed here, never by the
 * LLM. Output validated against ScoreBreakdownSchema before returning.
 */
export function scoreAnalysis(input: ScoringInput): ScoringResult {
  const dist = input.audience.distribution;
  const accounts = input.audience.accounts;
  const avgBot = avgBotScore(accounts);
  const sampleLevel = confidenceFromEvidence(input.sample, input.evidence);

  const goal = resolveGoal(input.org, input.brief);
  const targetBuckets = deriveTargetBuckets(input.org, input.brief, goal);

  // Risks first — they feed audience_quality / brand_safety and the verdict gate.
  const ppr = paidPromoRisk(input.content, sampleLevel);
  const bfr = botFarmRisk(dist, avgBot, sampleLevel);

  const eam = engagedAudienceMatch(dist, targetBuckets, sampleLevel);
  const aq = audienceQuality(dist, avgBot, sampleLevel);
  const cf = contentFit(input.content, input.org, input.brief, sampleLevel);
  const cgf = campaignGoalFit(dist, goal, eam.value, sampleLevel);
  const bs = brandSafety(dist, ppr.value);
  const glf = geoLanguageFit(input.brief.region ?? input.org.region);

  const weighted: Record<keyof typeof OVERALL_WEIGHTS, ScoreValue> = {
    engaged_audience_match: eam,
    audience_quality: aq,
    content_fit: cf,
    campaign_goal_fit: cgf,
    brand_safety: bs,
    geo_language_fit: glf,
  };

  const overallValue = clampRound(
    (Object.keys(OVERALL_WEIGHTS) as (keyof typeof OVERALL_WEIGHTS)[]).reduce(
      (sum, k) => sum + OVERALL_WEIGHTS[k] * weighted[k].value,
      0
    )
  );

  const verdict = verdictFromScore(overallValue, {
    paidPromoRisk: ppr.value,
    botFarmRisk: bfr.value,
  });

  // Overall reasons: top weighted drivers + any risk-gate note.
  const drivers = (Object.keys(OVERALL_WEIGHTS) as (keyof typeof OVERALL_WEIGHTS)[])
    .map((k) => ({
      k,
      contribution: OVERALL_WEIGHTS[k] * weighted[k].value,
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map(
      ({ k }) =>
        `${METRIC_LABELS[k]} ${weighted[k].value} (weight ${Math.round(
          OVERALL_WEIGHTS[k] * 100
        )}%)`
    );
  const overallReasons = [
    `Weighted fit ${overallValue}/100 → ${verdict}.`,
    `Top drivers: ${drivers.join(", ")}.`,
  ];
  if (riskGateApplied(overallValue, { paidPromoRisk: ppr.value, botFarmRisk: bfr.value })) {
    overallReasons.push(
      `Verdict capped at WEAK: paid-promo risk ${ppr.value}, bot/farm risk ${bfr.value}.`
    );
  }

  const overall: ScoreValue = {
    value: overallValue,
    confidence: sampleLevel,
    reasons: overallReasons,
  };

  const components: Partial<Record<ScoreMetric, ScoreValue>> = {
    engaged_audience_match: eam,
    audience_quality: aq,
    content_fit: cf,
    campaign_goal_fit: cgf,
    brand_safety: bs,
    geo_language_fit: glf,
    paid_promo_risk: ppr,
    bot_farm_risk: bfr,
  };

  const scores = ScoreBreakdownSchema.parse({
    overall,
    components,
    confidence: sampleLevel,
  });

  return { scores, verdict };
}
