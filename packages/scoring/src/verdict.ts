import type { ReportVerdict } from "@kol-fit/shared";

import {
  BOT_GATE_AVOID,
  BOT_GATE_OKAY,
  BOT_GATE_WEAK,
  BRAND_GATE_AVOID,
  BRAND_GATE_WEAK,
  PROMO_GATE_OKAY,
  PROMO_GATE_UNRELATED_SHARE,
  PROMO_GATE_WEAK,
  VERDICT_THRESHOLDS,
} from "./weights.js";

const RANK: ReportVerdict[] = ["AVOID", "WEAK", "OKAY", "GOOD", "STRONG"];

export type RiskGateInput = {
  paidPromoRisk: number;
  botFarmRisk: number;
  /** Share of promo posts outside the creator's domain (from paidPromoRisk). */
  promoUnrelatedShare: number;
  /** brand_safety metric value — severe confirmed safety findings gate. */
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
function lowerCap(a: ReportVerdict | null, b: ReportVerdict): ReportVerdict {
  return a === null || RANK.indexOf(b) < RANK.indexOf(a) ? b : a;
}

/** The verdict cap the risk gates impose, or null when no gate fires. Gates
 *  can only pull the verdict DOWN (v3 has no upward modifiers of any kind):
 *  - bot/farm risk: >= OKAY-gate caps OKAY; >= WEAK-gate (majority fake) caps
 *    WEAK; >= AVOID-gate (overwhelming fake/farmed) caps AVOID.
 *  - paid promo: gates ONLY when high AND mostly unrelated shilling — OKAY
 *    tier, then WEAK. Never AVOID on saturation alone (awareness value stays).
 *  - brand safety: severe confirmed findings gate independently — < WEAK-gate
 *    caps WEAK; < AVOID-gate caps AVOID.
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

/** Map fit score -> verdict, then apply the v3 risk gates. Deterministic. */
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
