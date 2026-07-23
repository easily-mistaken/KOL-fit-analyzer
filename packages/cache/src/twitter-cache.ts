import type {
  EngagedAccountRaw,
  Tweet,
  TwitterUser,
} from "@kol-fit/shared";
import type { TwitterProvider, UsageStats } from "@kol-fit/twitter";

import type { CacheConfig } from "./config.js";
import type { CacheStore } from "./store.js";

// v2: Unit 29A enriched normalization (reply/quote text, media). Bumped so
// pre-enrichment cached payloads can't silently starve an enriched analysis.
const KEY_PREFIX = "tw:v2";
const norm = (s: string): string => s.trim().toLowerCase();

/** The provider KIND is part of the cache identity (live-calibration incident,
 *  2026-07-14): mock and live providers share handles, so kind-less keys let a
 *  mock run poison the cache for live runs. Defaults to the same env the
 *  provider factory resolves. */
function resolveKind(explicit?: string): string {
  return (explicit ?? process.env.TWITTER_PROVIDER ?? "mock").trim().toLowerCase();
}

export interface CacheHitStats {
  hits: number;
  misses: number;
}

/**
 * Caches TwitterAPI.io reads (profiles/tweets/engagement) via an injected
 * CacheStore. Stores the NORMALIZED shared-type output (not raw payloads).
 * Miss-safe: any store error is swallowed and treated as a miss/no-op so
 * caching never fails an analysis (Invariant 8). Search is not cached.
 */
export class CachingTwitterProvider implements TwitterProvider {
  readonly cacheStats: CacheHitStats = { hits: 0, misses: 0 };
  /** Kind-namespaced key prefix, e.g. `tw:v2:twitterapi`. */
  private readonly ns: string;

  constructor(
    private readonly inner: TwitterProvider,
    private readonly store: CacheStore,
    private readonly config: CacheConfig,
    kind?: string
  ) {
    this.ns = `${KEY_PREFIX}:${resolveKind(kind)}`;
  }

  private async cached<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    if (!this.config.enabled) return fetchFn();
    try {
      const hit = await this.store.get(key);
      if (hit) {
        this.cacheStats.hits++;
        return hit.payload as T;
      }
    } catch {
      /* miss-safe: treat store error as a miss */
    }
    this.cacheStats.misses++;
    const value = await fetchFn();
    try {
      await this.store.set(key, value, ttlSeconds);
    } catch {
      /* miss-safe: caching write failure must not fail the analysis */
    }
    return value;
  }

  getUserProfile(handle: string): Promise<TwitterUser | null> {
    return this.cached(
      `${this.ns}:profile:${norm(handle)}`,
      this.config.ttls.profileSeconds,
      () => this.inner.getUserProfile(handle)
    );
  }

  getUserTweets(handle: string, limit: number): Promise<Tweet[]> {
    return this.cached(
      `${this.ns}:tweets:${norm(handle)}:${limit}`,
      this.config.ttls.tweetsSeconds,
      () => this.inner.getUserTweets(handle, limit)
    );
  }

  /** Freshness probe (Unit 48): same data as getUserTweets, but keyed apart
   *  and on the SHORT probe TTL, so activity stays current while the deep
   *  timeline rides the long, cheap TTL. Falls back to the inner
   *  getUserTweets when the wrapped provider lacks the optional method. */
  getLatestTweets(handle: string, limit: number): Promise<Tweet[]> {
    return this.cached(
      `${this.ns}:probe:${norm(handle)}:${limit}`,
      this.config.ttls.probeSeconds,
      () =>
        this.inner.getLatestTweets
          ? this.inner.getLatestTweets(handle, limit)
          : this.inner.getUserTweets(handle, limit)
    );
  }

  getUserReplies(handle: string, limit: number): Promise<Tweet[]> {
    return this.cached(
      `${this.ns}:replies:${norm(handle)}:${limit}`,
      this.config.ttls.tweetsSeconds,
      () => this.inner.getUserReplies(handle, limit)
    );
  }

  getTweetReplies(tweetId: string, limit: number): Promise<EngagedAccountRaw[]> {
    return this.cached(
      `${this.ns}:tweetReplies:${tweetId}:${limit}`,
      this.config.ttls.tweetsSeconds,
      () => this.inner.getTweetReplies(tweetId, limit)
    );
  }

  getTweetQuotes(tweetId: string, limit: number): Promise<EngagedAccountRaw[]> {
    return this.cached(
      `${this.ns}:tweetQuotes:${tweetId}:${limit}`,
      this.config.ttls.tweetsSeconds,
      () => this.inner.getTweetQuotes(tweetId, limit)
    );
  }

  getTweetRetweeters(
    tweetId: string,
    limit: number
  ): Promise<EngagedAccountRaw[]> {
    return this.cached(
      `${this.ns}:retweeters:${tweetId}:${limit}`,
      this.config.ttls.tweetsSeconds,
      () => this.inner.getTweetRetweeters(tweetId, limit)
    );
  }

  getFollowers(handle: string, limit: number): Promise<TwitterUser[]> {
    return this.cached(
      `${this.ns}:followers:${norm(handle)}:${limit}`,
      this.config.ttls.tweetsSeconds,
      () => this.inner.getFollowers(handle, limit)
    );
  }

  searchTweets(query: string, limit: number): Promise<Tweet[]> {
    // Query-variable and unused by the pipeline — pass through, not cached.
    return this.inner.searchTweets(query, limit);
  }

  /** Forwards the inner live provider's usage stats (if any) + cache hit/miss. */
  getUsageStats(): (UsageStats & { cache: CacheHitStats }) | undefined {
    const inner = (
      this.inner as { getUsageStats?: () => UsageStats }
    ).getUsageStats?.();
    return inner ? { ...inner, cache: { ...this.cacheStats } } : undefined;
  }
}

export function withTwitterCache(
  inner: TwitterProvider,
  store: CacheStore,
  config: CacheConfig,
  kind?: string
): CachingTwitterProvider {
  return new CachingTwitterProvider(inner, store, config, kind);
}
