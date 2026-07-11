// Public surface of @kol-fit/cache: DB-backed provider-data caching (Unit 19).
export {
  type CacheStore,
  type CacheEntry,
  InMemoryCacheStore,
  PrismaCacheStore,
} from "./store.js";
export {
  type CacheConfig,
  type CacheTtls,
  resolveCacheConfig,
  type ClassificationCacheConfig,
  type ClassificationCacheTtls,
  resolveClassificationCacheConfig,
} from "./config.js";
export {
  CachingTwitterProvider,
  withTwitterCache,
  type CacheHitStats,
} from "./twitter-cache.js";
export {
  CachingLlmProvider,
  withLlmCache,
  type LlmClassificationCacheStats,
} from "./llm-cache.js";
