import type { ReportVerdict } from "@kol-fit/shared";

import { RISK_GATE_THRESHOLD, VERDICT_THRESHOLDS } from "./weights.js";

const RANK: ReportVerdict[] = ["AVOID", "WEAK", "OKAY", "GOOD", "STRONG"];

function baseVerdict(overall: number): ReportVerdict {
  if (overall >= VERDICT_THRESHOLDS.STRONG) return "STRONG";
  if (overall >= VERDICT_THRESHOLDS.GOOD) return "GOOD";
  if (overall >= VERDICT_THRESHOLDS.OKAY) return "OKAY";
  if (overall >= VERDICT_THRESHOLDS.WEAK) return "WEAK";
  return "AVOID";
}

/**
 * Map overall_fit -> verdict, then apply the risk gate: a high paid-promo or
 * bot/farm risk (>= RISK_GATE_THRESHOLD) caps the verdict at WEAK (never
 * OKAY/GOOD/STRONG). Deterministic.
 */
export function verdictFromScore(
  overall: number,
  risks: { paidPromoRisk: number; botFarmRisk: number }
): ReportVerdict {
  const verdict = baseVerdict(overall);
  const highRisk =
    risks.botFarmRisk >= RISK_GATE_THRESHOLD ||
    risks.paidPromoRisk >= RISK_GATE_THRESHOLD;
  if (highRisk && RANK.indexOf(verdict) > RANK.indexOf("WEAK")) {
    return "WEAK";
  }
  return verdict;
}

/** True when the risk gate would lower the base verdict. For reason text. */
export function riskGateApplied(
  overall: number,
  risks: { paidPromoRisk: number; botFarmRisk: number }
): boolean {
  return baseVerdict(overall) !== verdictFromScore(overall, risks);
}
