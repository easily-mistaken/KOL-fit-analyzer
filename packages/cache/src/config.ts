export interface CacheTtls {
  /** Profiles change slowly. Default 24h. */
  profileSeconds: number;
  /** Tweets + engagement. Default 6h. */
  tweetsSeconds: number;
  /** Freshness probe (latest posts for the activity signal, Unit 48). MUST
   *  stay short even when tweetsSeconds is cranked up for cost: a stale probe
   *  makes an active creator look dormant. Default 6h. */
  probeSeconds: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttls: CacheTtls;
}

const DEFAULT_TTL_SECONDS = 21600; // 6h
const DEFAULT_PROFILE_TTL_SECONDS = 86400; // 24h
const DEFAULT_PROBE_TTL_SECONDS = 21600; // 6h — deliberately NOT tied to base

function num(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : def;
}

/** Cache config from env. `CACHE_ENABLED=false` disables caching (pass-through). */
export function resolveCacheConfig(): CacheConfig {
  const enabled =
    (process.env.CACHE_ENABLED ?? "true").trim().toLowerCase() !== "false";
  const base = num(process.env.CACHE_TTL_SECONDS, DEFAULT_TTL_SECONDS);
  return {
    enabled,
    ttls: {
      profileSeconds: num(
        process.env.CACHE_TTL_PROFILE_SECONDS,
        DEFAULT_PROFILE_TTL_SECONDS
      ),
      tweetsSeconds: num(process.env.CACHE_TTL_TWEETS_SECONDS, base),
      // Not defaulted from `base`: raising the bulk TTL for cost must never
      // silently stale the activity probe.
      probeSeconds: num(
        process.env.CACHE_TTL_PROBE_SECONDS,
        DEFAULT_PROBE_TTL_SECONDS
      ),
    },
  };
}

// --- Cross-analysis LLM classification cache (Unit 23) -----------------------

export interface ClassificationCacheTtls {
  orgSeconds: number;
  contentSeconds: number;
  audienceSeconds: number;
}

export interface ClassificationCacheConfig {
  enabled: boolean;
  ttls: ClassificationCacheTtls;
}

const DEFAULT_CLASSIFICATION_TTL_SECONDS = 1209600; // 14 days

/**
 * Config for the content-addressed classification cache. `CLASSIFICATION_CACHE_ENABLED=false`
 * disables it (pass-through). Base TTL is `CLASSIFICATION_CACHE_TTL_SECONDS`
 * (default 14d); per-kind overrides fall back to it.
 */
export function resolveClassificationCacheConfig(): ClassificationCacheConfig {
  const enabled =
    (process.env.CLASSIFICATION_CACHE_ENABLED ?? "true")
      .trim()
      .toLowerCase() !== "false";
  const base = num(
    process.env.CLASSIFICATION_CACHE_TTL_SECONDS,
    DEFAULT_CLASSIFICATION_TTL_SECONDS
  );
  return {
    enabled,
    ttls: {
      orgSeconds: num(process.env.CLASSIFICATION_CACHE_TTL_ORG_SECONDS, base),
      contentSeconds: num(
        process.env.CLASSIFICATION_CACHE_TTL_CONTENT_SECONDS,
        base
      ),
      audienceSeconds: num(
        process.env.CLASSIFICATION_CACHE_TTL_AUDIENCE_SECONDS,
        base
      ),
    },
  };
}
