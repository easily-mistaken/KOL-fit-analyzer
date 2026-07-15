import type { KolRelationship, ReportVerdict } from "@kol-fit/shared";

import {
  ADJACENT_CAP,
  ADJACENT_CAP_EXEMPT_GOALS,
  AUTHORITY_FLOOR_FOUNDER,
  AUTHORITY_MIN_BRAND_SAFETY,
  MEDIA_WEAK_SOFTEN_GOALS,
  BOT_GATE_AVOID,
  BOT_GATE_OKAY,
  BOT_GATE_WEAK,
  BRAND_GATE_AVOID,
  BRAND_GATE_WEAK,
  MEDIA_CAP_GOOD,
  MEDIA_CAP_OKAY,
  MEDIA_CAP_EAM_EXEMPT,
  MEDIA_INTENT_GOOD,
  MEDIA_INTENT_WEAK,
  PROMO_GATE_OKAY,
  PROMO_GATE_UNRELATED_SHARE,
  PROMO_GATE_WEAK,
  VERDICT_THRESHOLDS,
} from "./weights.js";

const RANK: ReportVerdict[] = ["AVOID", "WEAK", "OKAY", "GOOD", "STRONG"];

export type RiskGateInput = {
  paidPromoRisk: number;
  botFarmRisk: number;
  /** Share of promo posts outside the KOL's domain (from paidPromoRisk v2). */
  promoUnrelatedShare: number;
  /** brand_safety metric value — severe confirmed safety findings gate the
   *  verdict (Unit 29G). */
  brandSafety: number;
};

function baseVerdict(overall: number): ReportVerdict {
  if (overall >= VERDICT_THRESHOLDS.STRONG) return "STRONG";
  if (overall >= VERDICT_THRESHOLDS.GOOD) return "GOOD";
  if (overall >= VERDICT_THRESHOLDS.OKAY) return "OKAY";
  if (overall >= VERDICT_THRESHOLDS.WEAK) return "WEAK";
  return "AVOID";
}

/** The lower (more severe) of two verdict caps. */
function lowerCap(
  a: ReportVerdict | null,
  b: ReportVerdict
): ReportVerdict {
  return a === null || RANK.indexOf(b) < RANK.indexOf(a) ? b : a;
}

/** The verdict cap the risk gates impose, or null when no gate fires
 *  (severity tiers per the v26 calibration set, Unit 29G):
 *  - bot/farm risk: >= OKAY-gate caps OKAY; >= WEAK-gate (majority fake)
 *    caps WEAK; >= AVOID-gate (overwhelming fake/farmed) caps AVOID.
 *  - paid promo: gates ONLY when high AND mostly unrelated shilling —
 *    OKAY tier, then WEAK tier. Never AVOID on saturation alone
 *    (promo-heavy accounts retain awareness value).
 *  - brand safety: severe confirmed findings gate independently —
 *    < WEAK-gate caps WEAK; < AVOID-gate caps AVOID.
 *  Caps combine as the minimum. */
function gateCap(risks: RiskGateInput): ReportVerdict | null {
  let cap: ReportVerdict | null = null;
  if (risks.botFarmRisk >= BOT_GATE_AVOID) cap = lowerCap(cap, "AVOID");
  else if (risks.botFarmRisk >= BOT_GATE_WEAK) cap = lowerCap(cap, "WEAK");
  else if (risks.botFarmRisk >= BOT_GATE_OKAY) cap = lowerCap(cap, "OKAY");
  if (risks.promoUnrelatedShare > PROMO_GATE_UNRELATED_SHARE) {
    if (risks.paidPromoRisk >= PROMO_GATE_WEAK) cap = lowerCap(cap, "WEAK");
    else if (risks.paidPromoRisk >= PROMO_GATE_OKAY) cap = lowerCap(cap, "OKAY");
  }
  if (risks.brandSafety < BRAND_GATE_AVOID) cap = lowerCap(cap, "AVOID");
  else if (risks.brandSafety < BRAND_GATE_WEAK) cap = lowerCap(cap, "WEAK");
  return cap;
}

/** Map overall_fit -> verdict, then apply the v2 risk gates. Deterministic. */
export function verdictFromScore(
  overall: number,
  risks: RiskGateInput
): ReportVerdict {
  const verdict = baseVerdict(overall);
  const cap = gateCap(risks);
  if (cap !== null && RANK.indexOf(verdict) > RANK.indexOf(cap)) return cap;
  return verdict;
}

/** True when a risk gate lowered the base verdict. For reason text. */
export function riskGateApplied(
  overall: number,
  risks: RiskGateInput
): boolean {
  return baseVerdict(overall) !== verdictFromScore(overall, risks);
}

// --- Authority rules (Unit 29F) ----------------------------------------------

export type AuthorityContext = {
  relationship?: KolRelationship;
  /** engaged_audience_match value — exempts media accounts from the cap. */
  eam: number;
  brandSafety: number;
  /** audienceIntentOverlap 0-5 (Unit 30) — tiers the media cap. */
  intentOverlap?: number;
  /** Normalized campaign-goal key (Unit 32) — absent means the default
   *  "normal product-relevant campaign" assumption. */
  goalKey?: string;
  /** True when a risk gate already capped the verdict (floors never override). */
  riskGateFired: boolean;
};

export type AuthorityAdjustment = {
  verdict: ReportVerdict;
  applied: "founder_floor" | "media_cap" | "adjacent_cap" | null;
};

/**
 * Relationship-driven verdict floor/cap (Unit 29F) — applied AFTER the risk
 * gates. Founder/core-team pairs get a floor (noisy engagement must not
 * collapse them) unless a risk gate fired or brand safety is severe.
 * Media/news accounts cap at OKAY unless the engaged-audience match itself
 * proves quality. Adjacent authority and independent specialists earn their
 * verdict through the metrics (no floor/cap).
 */
export function applyAuthorityRules(
  verdict: ReportVerdict,
  ctx: AuthorityContext
): AuthorityAdjustment {
  if (
    (ctx.relationship === "founder_or_core_team" ||
      ctx.relationship === "official_ecosystem_lead") &&
    !ctx.riskGateFired &&
    ctx.brandSafety >= AUTHORITY_MIN_BRAND_SAFETY &&
    RANK.indexOf(verdict) < RANK.indexOf(AUTHORITY_FLOOR_FOUNDER)
  ) {
    return { verdict: AUTHORITY_FLOOR_FOUNDER, applied: "founder_floor" };
  }
  if (
    ctx.relationship === "adjacent_ecosystem_authority" &&
    !(ctx.goalKey && ADJACENT_CAP_EXEMPT_GOALS.includes(ctx.goalKey)) &&
    RANK.indexOf(verdict) > RANK.indexOf(ADJACENT_CAP)
  ) {
    // Unit 32: adjacent fame needs direct authority or an aligned goal
    // (awareness/credibility) to reach STRONG.
    return { verdict: ADJACENT_CAP, applied: "adjacent_cap" };
  }
  if (ctx.relationship === "media_or_news") {
    // Intent-tiered (Unit 30): readers without product intent are reach, not
    // fit -> WEAK. Audience proof (EAM) + real intent earns GOOD, never
    // STRONG — "media fit should be useful but not automatically elite".
    // Unknown intent falls back to the 29E EAM-only tiers.
    const i = ctx.intentOverlap;
    // Unit 32: under an awareness goal the WEAK tier softens to OKAY —
    // broad reach IS useful for a pure awareness burst.
    const weakTier =
      ctx.goalKey && MEDIA_WEAK_SOFTEN_GOALS.includes(ctx.goalKey)
        ? MEDIA_CAP_OKAY
        : "WEAK";
    const cap =
      i !== undefined && i <= MEDIA_INTENT_WEAK
        ? weakTier
        : ctx.eam >= MEDIA_CAP_EAM_EXEMPT &&
            (i === undefined || i >= MEDIA_INTENT_GOOD)
          ? MEDIA_CAP_GOOD
          : MEDIA_CAP_OKAY;
    if (RANK.indexOf(verdict) > RANK.indexOf(cap)) {
      return { verdict: cap, applied: "media_cap" };
    }
  }
  return { verdict, applied: null };
}
