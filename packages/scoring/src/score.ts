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
  contentFit,
  engagedAudienceMatch,
  expectedReach,
  geoLanguageFit,
  mediaProfileReason,
  normalizeGoal,
  paidPromoRisk,
  regionDistribution,
  resolveGoal,
  resolveTargets,
} from "./metrics.js";
import type { ScoringInput, ScoringResult } from "./types.js";
import { riskGateApplied, verdictFromScore } from "./verdict.js";

/**
 * Deterministic, explainable scoring (v3 — "audience-honest", Unit 41).
 *
 * The fit score IS the engaged-audience match: what share of the creator's
 * real, engaged audience is the brand's target customer. There are NO
 * identity/relationship modifiers and NO weighted blend — content fit, goal
 * fit, and geo/language are computed for context but do NOT move the score.
 * Brand-safety, bot/farm, and paid-promo act only as verdict GATES (down-only).
 *
 * Numbers are computed here, never by the LLM. Output validated against
 * ScoreBreakdownSchema. See context/specs/41-scoring-v3-audience-honest.md.
 */
export function scoreAnalysis(input: ScoringInput): ScoringResult {
  const dist = input.audience.distribution;
  const accounts = input.audience.accounts;
  const avgBot = avgBotScore(accounts);
  const sampleLevel = confidenceFromEvidence(input.sample, input.evidence);

  const goalRaw = resolveGoal(input.org, input.brief);
  const goalKey = normalizeGoal(goalRaw);
  const targets = resolveTargets(input.org, input.brief, goalKey);
  // Brand's economically-valued regions (Phase C) — drives the soft geo tilt.
  const valuedRegions = new Set(input.org.valuedRegions ?? []);

  // Risks: gates + dials, NOT weighted terms.
  const ppr = paidPromoRisk(input.content, sampleLevel);
  const bfr = botFarmRisk(dist, avgBot, sampleLevel);

  // THE fit score = engaged-audience match (with a soft geography tilt). No
  // identity, no intent adjustment.
  const eam = engagedAudienceMatch(
    accounts,
    dist,
    targets,
    sampleLevel,
    valuedRegions
  );
  // Region breakdown of the engaged audience — a dial beside the score.
  const audienceRegions = regionDistribution(accounts);

  // Expected reach: a DIAL beside the score (how MANY target customers engage
  // per post), never blended into the fit (Phase B). value = reach / price and
  // only the brand knows the price.
  const reach = expectedReach(
    accounts,
    targets,
    input.sample.avgEngagedPerPost,
    sampleLevel
  );

  // Informational metrics (shown as components/dials; they do NOT move overall).
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

  // overall_fit == engaged_audience_match. That is the whole thesis.
  const overallValue = eam.value;

  const gateInput = {
    paidPromoRisk: ppr.value.value,
    botFarmRisk: bfr.value,
    promoUnrelatedShare: ppr.unrelatedShare,
    brandSafety: bs.value,
  };
  const verdict = verdictFromScore(overallValue, gateInput);
  const gateFired = riskGateApplied(overallValue, gateInput);

  const overallReasons = [
    `Fit ${overallValue}/100 = engaged-audience match → ${verdict}. The score is the audience: how much of who actually engages is the brand's target customer.`,
    ...eam.reasons.slice(0, 1),
  ];
  if (gateFired) {
    overallReasons.push(
      `Verdict capped by a risk gate: paid-promo risk ${ppr.value.value} (unrelated share ${Math.round(
        ppr.unrelatedShare * 100
      )}%), bot/farm risk ${bfr.value}, brand safety ${bs.value}.`
    );
  }

  // Unknown-target guard (Unit 41): a generic-target fallback (org couldn't be
  // classified) is capped + low-confidence in the EAM already — mirror that on
  // the overall so a mystery brand never surfaces a confident STRONG.
  const genericTarget = targets.source === "generic";
  if (genericTarget) {
    overallReasons.push(
      "Fit capped and low-confidence: the brand's target audience couldn't be determined, so this was matched against a generic crypto audience. Add product/target context for a real fit."
    );
  }
  const effectiveConfidence = genericTarget ? "low" : sampleLevel;

  const overall: ScoreValue = {
    value: overallValue,
    confidence: effectiveConfidence,
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
    confidence: effectiveConfidence,
  });

  return { scores, verdict, expectedReach: reach, audienceRegions };
}
