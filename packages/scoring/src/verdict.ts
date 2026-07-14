import type { ReportVerdict } from "@kol-fit/shared";

import {
  BOT_GATE_OKAY,
  BOT_GATE_WEAK,
  PROMO_GATE_OKAY,
  PROMO_GATE_UNRELATED_SHARE,
  VERDICT_THRESHOLDS,
} from "./weights.js";

const RANK: ReportVerdict[] = ["AVOID", "WEAK", "OKAY", "GOOD", "STRONG"];

export type RiskGateInput = {
  paidPromoRisk: number;
  botFarmRisk: number;
  /** Share of promo posts outside the KOL's domain (from paidPromoRisk v2). */
  promoUnrelatedShare: number;
};

function baseVerdict(overall: number): ReportVerdict {
  if (overall >= VERDICT_THRESHOLDS.STRONG) return "STRONG";
  if (overall >= VERDICT_THRESHOLDS.GOOD) return "GOOD";
  if (overall >= VERDICT_THRESHOLDS.OKAY) return "OKAY";
  if (overall >= VERDICT_THRESHOLDS.WEAK) return "WEAK";
  return "AVOID";
}

/** The verdict cap the v2 risk gates impose, or null when no gate fires.
 *  Softened vs v1 (bots are endemic; promo is the KOL business model):
 *  - bot/farm risk >= BOT_GATE_WEAK (majority-fake engagement) -> cap WEAK;
 *    >= BOT_GATE_OKAY -> cap OKAY.
 *  - paid-promo risk gates ONLY when high AND mostly unrelated shilling
 *    (> PROMO_GATE_UNRELATED_SHARE) -> cap OKAY. */
function gateCap(risks: RiskGateInput): ReportVerdict | null {
  let cap: ReportVerdict | null = null;
  if (risks.botFarmRisk >= BOT_GATE_WEAK) cap = "WEAK";
  else if (risks.botFarmRisk >= BOT_GATE_OKAY) cap = "OKAY";
  if (
    risks.paidPromoRisk >= PROMO_GATE_OKAY &&
    risks.promoUnrelatedShare > PROMO_GATE_UNRELATED_SHARE
  ) {
    if (cap === null || RANK.indexOf("OKAY") < RANK.indexOf(cap)) cap = "OKAY";
  }
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
