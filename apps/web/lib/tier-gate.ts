import { decideTier, resolveTierLimits, type TierLimits } from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

// Tiered access funnel (Unit 34): 3 lifetime analyses per anonymous browser →
// Google login → 10 lifetime per account → the detailed-report concierge tier
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

// Derived from the resolved limits, never hardcoded: the allowances are env
// -configurable, so literal numbers in copy silently lie the moment anyone sets
// FREE_TIER_*_LIFETIME (they already had, at 12 vs. a since-lowered 10).
function messageFor(
  gate: "login_required" | "upgrade_required",
  limits: TierLimits
): string {
  return gate === "login_required"
    ? `You've used your ${limits.anonLifetime} free analyses. Sign in with Google to unlock more. It takes ten seconds.`
    : `You've used all ${limits.userLifetime} of your analyses. Request more, or a hand-curated report.`;
}

/** The user's effective lifetime allowance: their per-user override when the
 *  operator has raised it (Unit 47), else the passed free-tier fallback. Only
 *  meaningful for signed-in owners, where ownerId == User.id. */
export async function getUserAnalysisLimit(
  userId: string,
  fallback: number
): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { analysisLimit: true },
  });
  return user?.analysisLimit ?? fallback;
}

/** Lifetime analyses counted against the funnel tiers. Single source of truth
 *  for the gate AND the quota indicator (Unit 39). FAILED runs don't count
 *  (Unit 40 fairness) — the DAILY abuse caps still count everything, since
 *  they are spend protection rather than product allowance. */
export async function countLifetimeAnalyses(ownerId: string): Promise<number> {
  return prisma.analysisRequest.count({
    where: { ownerId, job: { status: { not: "FAILED" } } },
  });
}

export async function checkTierGate(
  ownerId: string,
  isAuthenticated: boolean
): Promise<TierGateDecision> {
  const base = resolveTierLimits(process.env);
  // Signed-in users may have a raised allowance (Unit 47); apply it before the
  // decision so the gate and its copy reflect their real limit.
  const userLifetime = isAuthenticated
    ? await getUserAnalysisLimit(ownerId, base.userLifetime)
    : base.userLifetime;
  const limits: TierLimits = { ...base, userLifetime };
  const lifetime = await countLifetimeAnalyses(ownerId);
  const decision = decideTier(lifetime, isAuthenticated, limits);
  if (decision.allowed) return { allowed: true };
  return {
    allowed: false,
    code: decision.gate,
    message: messageFor(decision.gate, limits),
  };
}
