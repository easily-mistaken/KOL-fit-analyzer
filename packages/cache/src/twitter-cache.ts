import type {
  EngagedAccountRaw,
  Tweet,
  TwitterUser,
} from "@kol-fit/shared";
import type { TwitterProvider, UsageStats } from "@kol-fit/twitter";

import type { CacheConfig } from "./config.js";
import type { CacheStore } from "./store.js";

const KEY_PREFIX = "tw:v1";
const norm = (s: string): string => s.trim().toLowerCase();

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

  constructor(
    private readonly inner: TwitterProvider,
    private readonly store: CacheStore,
    private readonly config: CacheConfig
  ) {}

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
      `${KEY_PREFIX}:profile:${norm(handle)}`,
      this.config.ttls.profileSeconds,
      () => this.inner.getUserProfile(handle)
    );
  }

  getUserTweets(handle: string, limit: number): Promise<Tweet[]> {
    return this.cached(
      `${KEY_PREFIX}:tweets:${norm(handle)}:${limit}`,
      this.config.ttls.tweetsSeconds,
      () => this.inner.getUserTweets(handle, limit)
    );
  }

  getUserReplies(handle: string, limit: number): Promise<Tweet[]> {
    return this.cached(
      `${KEY_PREFIX}:replies:${norm(handle)}:${limit}`,
      this.config.ttls.tweetsSeconds,
      () => this.inner.getUserReplies(handle, limit)
    );
  }

  getTweetReplies(tweetId: string, limit: number): Promise<EngagedAccountRaw[]> {
    return this.cached(
      `${KEY_PREFIX}:tweetReplies:${tweetId}:${limit}`,
      this.config.ttls.tweetsSeconds,
      () => this.inner.getTweetReplies(tweetId, limit)
    );
  }

  getTweetQuotes(tweetId: string, limit: number): Promise<EngagedAccountRaw[]> {
    return this.cached(
      `${KEY_PREFIX}:tweetQuotes:${tweetId}:${limit}`,
      this.config.ttls.tweetsSeconds,
      () => this.inner.getTweetQuotes(tweetId, limit)
    );
  }

  getTweetRetweeters(
    tweetId: string,
    limit: number
  ): Promise<EngagedAccountRaw[]> {
    return this.cached(
      `${KEY_PREFIX}:retweeters:${tweetId}:${limit}`,
      this.config.ttls.tweetsSeconds,
      () => this.inner.getTweetRetweeters(tweetId, limit)
    );
  }

  getFollowers(handle: string, limit: number): Promise<TwitterUser[]> {
    return this.cached(
      `${KEY_PREFIX}:followers:${norm(handle)}:${limit}`,
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
  config: CacheConfig
): CachingTwitterProvider {
  return new CachingTwitterProvider(inner, store, config);
}
