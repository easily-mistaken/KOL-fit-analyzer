export interface CacheTtls {
  /** Profiles change slowly. Default 24h. */
  profileSeconds: number;
  /** Tweets + engagement. Default 6h. */
  tweetsSeconds: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttls: CacheTtls;
}

const DEFAULT_TTL_SECONDS = 21600; // 6h
const DEFAULT_PROFILE_TTL_SECONDS = 86400; // 24h

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
    },
  };
}
