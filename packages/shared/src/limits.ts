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

// --- Tiered access funnel (Unit 34) ------------------------------------------
// 3 lifetime analyses per anonymous browser -> Google login -> 10 lifetime per
// account (claimed anonymous history included) -> the detailed-report
// concierge tier (Unit 35). LIFETIME counts, distinct from the rolling daily
// abuse caps above, which stay in force on top.

export interface TierLimits {
  anonLifetime: number;
  userLifetime: number;
}

export const TIER_LIMITS: TierLimits = {
  anonLifetime: 3,
  userLifetime: 10,
};

export const TIER_LIMIT_ENV_VARS: Record<keyof TierLimits, string> = {
  anonLifetime: "FREE_TIER_ANON_LIFETIME",
  userLifetime: "FREE_TIER_USER_LIFETIME",
};

/** Pure env resolution, same idiom as resolveAbuseLimits. */
export function resolveTierLimits(
  env: Record<string, string | undefined> = {}
): TierLimits {
  return {
    anonLifetime: posInt(
      env[TIER_LIMIT_ENV_VARS.anonLifetime],
      TIER_LIMITS.anonLifetime
    ),
    userLifetime: posInt(
      env[TIER_LIMIT_ENV_VARS.userLifetime],
      TIER_LIMITS.userLifetime
    ),
  };
}

export type TierDecision =
  | { allowed: true }
  | { allowed: false; gate: "login_required" | "upgrade_required" };

/** Pure funnel decision from the owner's LIFETIME analysis count. */
export function decideTier(
  lifetimeCount: number,
  isAuthenticated: boolean,
  limits: TierLimits = TIER_LIMITS
): TierDecision {
  if (!isAuthenticated) {
    return lifetimeCount >= limits.anonLifetime
      ? { allowed: false, gate: "login_required" }
      : { allowed: true };
  }
  return lifetimeCount >= limits.userLifetime
    ? { allowed: false, gate: "upgrade_required" }
    : { allowed: true };
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

// --- Twitter provider spend estimation (Unit 50) ------------------------------
// The MAX_DAILY_SPEND_USD gate sums ProviderUsageLog.costUsd, and a cost that
// is never computed cannot gate anything (the 2026-07-23 finding: the $25 cap
// was dead because no row ever carried a cost). LLM cost stays env-priced in
// the worker (estimateLlmCostUsd); Twitter cost is estimated here from the
// usage counters with REAL DEFAULTS baked in, so the gate works even when the
// env is silent. Rates follow twitterapi.io published pricing: $0.15 per 1k
// tweets, $0.18 per 1k profiles, 15-credit (=$0.00015) minimum per call.

export interface TwitterCostRates {
  /** USD per 1,000 tweets returned. */
  perThousandTweets: number;
  /** USD per 1,000 user profiles returned. */
  perThousandProfiles: number;
  /** USD minimum charge per API request. */
  minPerRequest: number;
}

export const TWITTER_COST_RATES: TwitterCostRates = {
  perThousandTweets: 0.15,
  perThousandProfiles: 0.18,
  minPerRequest: 0.00015,
};

export const TWITTER_COST_ENV_VARS: Record<keyof TwitterCostRates, string> = {
  perThousandTweets: "TWITTERAPI_COST_PER_1K_TWEETS",
  perThousandProfiles: "TWITTERAPI_COST_PER_1K_PROFILES",
  minPerRequest: "TWITTERAPI_MIN_COST_PER_REQUEST",
};

/** Pure env resolution, same idiom as resolveAbuseLimits. */
export function resolveTwitterCostRates(
  env: Record<string, string | undefined> = {}
): TwitterCostRates {
  return {
    perThousandTweets: nonNegNum(
      env[TWITTER_COST_ENV_VARS.perThousandTweets],
      TWITTER_COST_RATES.perThousandTweets
    ),
    perThousandProfiles: nonNegNum(
      env[TWITTER_COST_ENV_VARS.perThousandProfiles],
      TWITTER_COST_RATES.perThousandProfiles
    ),
    minPerRequest: nonNegNum(
      env[TWITTER_COST_ENV_VARS.minPerRequest],
      TWITTER_COST_RATES.minPerRequest
    ),
  };
}

/**
 * Estimated USD cost of one analysis's Twitter usage. Adds the per-request
 * minimum ON TOP of the per-item cost rather than reconstructing the provider's
 * exact per-call max(items, minimum): the aggregate counters cannot say which
 * calls were empty, and for a SPEND CAP a mild overestimate (at most
 * requests x minPerRequest, about two cents on a typical fresh-creator run)
 * fails in the safe direction.
 */
export function estimateTwitterCostUsd(
  usage: {
    requests?: number | null;
    tweetsFetched?: number | null;
    usersFetched?: number | null;
  },
  rates: TwitterCostRates = TWITTER_COST_RATES
): number {
  const n = (v: number | null | undefined): number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  return (
    (n(usage.tweetsFetched) / 1000) * rates.perThousandTweets +
    (n(usage.usersFetched) / 1000) * rates.perThousandProfiles +
    n(usage.requests) * rates.minPerRequest
  );
}
