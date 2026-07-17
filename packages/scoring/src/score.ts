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
  mediaProfileReason,
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
import {
  AUTHORITY_OVERALL_BOOST_FOUNDER,
  OVERALL_WEIGHTS,
} from "./weights.js";

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

  const intentOverlap = input.contentFitAssessment?.audienceIntentOverlap;
  const eam = engagedAudienceMatch(
    accounts,
    dist,
    targets,
    sampleLevel,
    intentOverlap
  );
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
  // Visual-content profile (Unit 31): deterministic evidence from the 29B
  // vision labels, surfaced with the content assessment.
  const mediaReason = mediaProfileReason(input.content);
  if (mediaReason) cf.reasons.push(mediaReason);
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

  // Founder/core-team authority modifier (v26 rule 1 via 29E tuning): a flat
  // overall lift on top of the metrics — direct authority is real signal the
  // audience-derived metrics cannot see. Official ecosystem leads get the
  // same lift except under a pure retail awareness goal (Unit 32, v26:
  // "STRONG for builder campaigns, GOOD for broad retail awareness").
  const relationship = input.contentFitAssessment?.relationship;
  const authorityBoost =
    relationship === "founder_or_core_team" ||
    (relationship === "official_ecosystem_lead" && goalKey !== "awareness")
      ? AUTHORITY_OVERALL_BOOST_FOUNDER
      : 0;

  const overallValue = clampRound(
    (Object.keys(OVERALL_WEIGHTS) as (keyof typeof OVERALL_WEIGHTS)[]).reduce(
      (sum, k) => sum + OVERALL_WEIGHTS[k] * weighted[k].value,
      0
    ) + authorityBoost
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
  const authority = applyAuthorityRules(gated, {
    relationship,
    eam: eam.value,
    brandSafety: bs.value,
    intentOverlap,
    goalKey,
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
      `Creator's relationship to the brand: ${relationship.replace(/_/g, " ")}${evidence ? `. ${evidence}` : "."}`
    );
  }
  if (authorityBoost > 0) {
    overallReasons.push(
      `Founder/core-team authority modifier: +${authorityBoost} on the overall score.`
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
  } else if (authority.applied === "adjacent_cap") {
    overallReasons.push(
      `Adjacent-authority cap applied (${gated} → ${verdict}): ecosystem fame without direct org authority tops out at GOOD for a product-relevant campaign${goalKey ? ` (goal "${goalKey}")` : ""}; awareness/credibility goals lift this cap.`
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
