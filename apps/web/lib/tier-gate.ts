import { decideTier, resolveTierLimits } from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

// Tiered access funnel (Unit 34): 3 lifetime analyses per anonymous browser →
// Google login → 12 lifetime per account → the detailed-report concierge tier
// (Unit 35). Runs BEFORE the daily abuse rate limit so the funnel message wins.
// Lifetime = all AnalysisRequest rows for the owner id; the Unit 28 login
// claim reassigns anonymous rows to the user id, so free-tier usage counts
// toward the account allowance by construction.

export type TierGateDecision =
  | { allowed: true }
  | {
      allowed: false;
      code: "login_required" | "upgrade_required";
      message: string;
    };

const MESSAGES = {
  login_required:
    "You've used your 3 free analyses. Sign in with Google to unlock more — it takes ten seconds.",
  upgrade_required:
    "You've used all 12 included analyses. Request a detailed report and we'll deliver a curated analysis straight to your Telegram within a day.",
} as const;

/** Lifetime analyses counted against the funnel tiers. Single source of truth
 *  for the gate AND the quota indicator (Unit 39). */
export async function countLifetimeAnalyses(ownerId: string): Promise<number> {
  return prisma.analysisRequest.count({ where: { ownerId } });
}

export async function checkTierGate(
  ownerId: string,
  isAuthenticated: boolean
): Promise<TierGateDecision> {
  const limits = resolveTierLimits(process.env);
  const lifetime = await countLifetimeAnalyses(ownerId);
  const decision = decideTier(lifetime, isAuthenticated, limits);
  if (decision.allowed) return { allowed: true };
  return {
    allowed: false,
    code: decision.gate,
    message: MESSAGES[decision.gate],
  };
}
