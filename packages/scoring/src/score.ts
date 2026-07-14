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
  engagedAudienceMatch,
  geoLanguageFit,
  normalizeGoal,
  paidPromoRisk,
  resolveGoal,
  resolveTargets,
} from "./metrics.js";
import type { ScoringInput, ScoringResult } from "./types.js";
import {
  applyAuthorityRules,
  riskGateApplied,
  verdictFromScore,
} from "./verdict.js";
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
 * Deterministic, explainable scoring (v2, Unit 29C). Computes the 9 metrics
 * through calibration curves + baselines (weights.ts), the weighted overall,
 * a verdict (with the softened risk gates), and confidence — all from the
 * pipeline's structured classifications/evidence. Numbers are computed here,
 * never by the LLM. Output validated against ScoreBreakdownSchema.
 */
export function scoreAnalysis(input: ScoringInput): ScoringResult {
  const dist = input.audience.distribution;
  const accounts = input.audience.accounts;
  const avgBot = avgBotScore(accounts);
  const sampleLevel = confidenceFromEvidence(input.sample, input.evidence);

  const goalRaw = resolveGoal(input.org, input.brief);
  const goalKey = normalizeGoal(goalRaw);
  const targets = resolveTargets(input.org, input.brief, goalKey);

  // Risks first — bot risk feeds the verdict gate; promo risk carries the
  // unrelated-share the promo gate needs.
  const ppr = paidPromoRisk(input.content, sampleLevel);
  const bfr = botFarmRisk(dist, avgBot, sampleLevel);

  const eam = engagedAudienceMatch(accounts, dist, targets, sampleLevel);
  const aq = audienceQuality(
    dist,
    input.sample.repeatEngagerShare ?? 0,
    sampleLevel
  );
  const cf = contentFit(
    input.contentFitAssessment,
    input.content,
    input.org,
    input.brief,
    sampleLevel
  );
  const cgf = campaignGoalFit(
    accounts,
    dist,
    goalRaw,
    goalKey,
    targets,
    eam.value,
    sampleLevel
  );
  const bs = brandSafety(input.content);
  const glf = geoLanguageFit(
    input.brief.region ?? input.org.region,
    input.kolPostLangs
  );

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

  const gateInput = {
    paidPromoRisk: ppr.value.value,
    botFarmRisk: bfr.value,
    promoUnrelatedShare: ppr.unrelatedShare,
    brandSafety: bs.value,
  };
  const gated = verdictFromScore(overallValue, gateInput);
  const gateFired = riskGateApplied(overallValue, gateInput);

  // Authority modifier (Unit 29F): relationship-driven floor/cap after gates.
  const relationship = input.contentFitAssessment?.relationship;
  const authority = applyAuthorityRules(gated, {
    relationship,
    eam: eam.value,
    brandSafety: bs.value,
    riskGateFired: gateFired,
  });
  const verdict = authority.verdict;

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
  if (gateFired) {
    overallReasons.push(
      `Verdict capped by risk gate: paid-promo risk ${ppr.value.value} (unrelated share ${Math.round(
        ppr.unrelatedShare * 100
      )}%), bot/farm risk ${bfr.value}, brand safety ${bs.value}.`
    );
  }
  if (relationship && relationship !== "none") {
    const evidence = input.contentFitAssessment?.relationshipEvidence;
    overallReasons.push(
      `KOL relationship to the org: ${relationship.replace(/_/g, " ")}${evidence ? ` — ${evidence}` : "."}`
    );
  }
  if (authority.applied === "founder_floor") {
    overallReasons.push(
      `Founder/core-team authority floor applied (${gated} → ${verdict}): noisy engagement lowers confidence, not a founder pair's verdict.`
    );
  } else if (authority.applied === "media_cap") {
    overallReasons.push(
      `Media/news cap applied (${gated} → ${verdict}): broad reach is not product fit, and engaged-audience match ${eam.value} did not clear the exemption bar.`
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
    paid_promo_risk: ppr.value,
    bot_farm_risk: bfr,
  };

  const scores = ScoreBreakdownSchema.parse({
    overall,
    components,
    confidence: sampleLevel,
  });

  return { scores, verdict };
}
