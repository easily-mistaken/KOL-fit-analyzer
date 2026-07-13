import { resolveAbuseLimits } from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

// Abuse & cost controls (Unit 26). A DB-backed circuit-breaker + per-owner rate
// limit in front of analysis creation. Reads saved counts only (two count()
// reads, plus an optional cost sum) — never triggers provider work. Real
// multi-user auth is a future unit; this bounds worst-case spend meanwhile.

export type LimitDecision =
  | { allowed: true }
  | { allowed: false; message: string };

/**
 * Decides whether `ownerId` may create another analysis right now, over a
 * rolling 24h window. Order: per-owner cap, then the global spend-ceiling cap,
 * then (if enabled) the summed provider-spend cap. Limits come from
 * resolveAbuseLimits(process.env). Throws on DB errors so the caller's try/catch
 * can fall through to a generic 500 (no leak).
 */
export async function checkAnalysisRateLimit(
  ownerId: string
): Promise<LimitDecision> {
  const limits = resolveAbuseLimits(process.env);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const perOwner = await prisma.analysisRequest.count({
    where: { ownerId, createdAt: { gte: since } },
  });
  if (perOwner >= limits.perOwnerPerDay) {
    return {
      allowed: false,
      message:
        "You've reached the daily limit for new analyses from this browser. Please try again later.",
    };
  }

  const global = await prisma.analysisRequest.count({
    where: { createdAt: { gte: since } },
  });
  if (global >= limits.globalPerDay) {
    return {
      allowed: false,
      message:
        "The analyzer is at capacity right now. Please try again a little later.",
    };
  }

  // Optional spend gate. ProviderUsageLog has a usable `createdAt` timestamp
  // (schema.prisma), so summing costUsd over the window is well-defined. 0
  // disables the gate.
  if (limits.maxDailySpendUsd > 0) {
    const agg = await prisma.providerUsageLog.aggregate({
      _sum: { costUsd: true },
      where: { createdAt: { gte: since } },
    });
    // costUsd is a Prisma Decimal (nullable). Number() coerces it (and null ->
    // 0 via the ?? guard) for the comparison.
    const spent = agg._sum.costUsd ? Number(agg._sum.costUsd) : 0;
    if (spent >= limits.maxDailySpendUsd) {
      return {
        allowed: false,
        message:
          "The analyzer has hit its daily budget. Please try again tomorrow.",
      };
    }
  }

  return { allowed: true };
}
