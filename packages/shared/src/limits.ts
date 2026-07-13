// Abuse & cost controls (Unit 26). Bounds worst-case third-party spend for the
// public, unauthenticated POST /api/analyses endpoint. Environment overrides are
// applied by resolveAbuseLimits(); the web rate-limit check reads DB counts and
// compares them against the resolved limits. Mirrors the resolveCaps()/posInt()
// idiom in @kol-fit/analysis and packages/shared/src/caps.ts.
export interface AbuseLimits {
  perOwnerPerDay: number; // max analyses one owner cookie may create per rolling 24h
  globalPerDay: number; // max analyses across ALL owners per rolling 24h (the spend ceiling)
  maxDailySpendUsd: number; // refuse when summed ProviderUsageLog cost in 24h >= this; 0 = disabled
}

export const ABUSE_LIMITS: AbuseLimits = {
  perOwnerPerDay: 10,
  globalPerDay: 200,
  maxDailySpendUsd: 0,
};

/** Maps each abuse limit to its environment override name. */
export const ABUSE_LIMIT_ENV_VARS: Record<keyof AbuseLimits, string> = {
  perOwnerPerDay: "MAX_ANALYSES_PER_OWNER_PER_DAY",
  globalPerDay: "MAX_ANALYSES_PER_DAY",
  maxDailySpendUsd: "MAX_DAILY_SPEND_USD",
};

// Positive integer parse: valid finite > 0 -> truncated int; else the default.
function posInt(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : def;
}

// Non-negative number parse: valid finite >= 0 -> the number; else the default.
// Used for maxDailySpendUsd where 0 is a valid value that disables the gate.
function nonNegNum(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

/**
 * Resolves abuse limits from environment overrides on top of the defaults.
 * `perOwnerPerDay`/`globalPerDay` must be > 0 to override (invalid/absent/
 * non-positive -> default). `maxDailySpendUsd` accepts >= 0 (0 disables the
 * spend gate); invalid/absent -> default. Pure: takes env as input (callers pass
 * `process.env`; the shared package stays free of a Node type dependency).
 */
export function resolveAbuseLimits(
  env: Record<string, string | undefined> = {}
): AbuseLimits {
  return {
    perOwnerPerDay: posInt(
      env[ABUSE_LIMIT_ENV_VARS.perOwnerPerDay],
      ABUSE_LIMITS.perOwnerPerDay
    ),
    globalPerDay: posInt(
      env[ABUSE_LIMIT_ENV_VARS.globalPerDay],
      ABUSE_LIMITS.globalPerDay
    ),
    maxDailySpendUsd: nonNegNum(
      env[ABUSE_LIMIT_ENV_VARS.maxDailySpendUsd],
      ABUSE_LIMITS.maxDailySpendUsd
    ),
  };
}
