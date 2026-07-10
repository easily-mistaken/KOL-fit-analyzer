# Unit 19: Caching and Cost Controls

## Goal

Reduce the real API cost of an analysis (Unit 18 showed ~130 TwitterAPI.io calls + ~11 OpenAI calls per run) by:

1. **Database-backed caching** of TwitterAPI.io provider data (profiles, recent tweets, per-post engagement) so repeated/overlapping requests don't re-pay.
2. **Adjustable cost/sampling controls** — make the `ANALYSIS_CAPS` env-overridable (the caps.ts comment already defers this here) and improve the audience-classification sampling.
3. **Provider usage logging** — persist per-run request/token (and best-effort cost) metadata to the existing `ProviderUsageLog` table.

Postgres-backed only (no Redis — architecture.md: "Do not add Redis initially").

Key architectural constraint (preserve it): the pipeline (`packages/analysis`) and the providers (`packages/twitter`, `packages/llm`) are deliberately **`@kol-fit/db`-free** and pure. So caching and usage-logging — which need DB access — live **worker-side**, wrapping the providers before they're passed into `runAnalysis` (which already accepts injected providers via options). The pipeline stays db-free and unchanged in shape.

Explicit non-goals (later / never):

- No Redis / external cache (architecture defers it).
- No LLM-output caching this unit (classification inputs are large/variable; caching targets the high-volume, handle/tweet-keyable **Twitter** data). Noted as a possible future extension.
- No per-request UI sample-size controls (env-level operator controls only; a per-request/workspace settings model is an optional future extension — see Open Questions).
- No saved-reports list / report-result reuse across requests (that's Unit 20).
- No commits.

## Where Caching & Usage-Logging Live (architecture)

- **New `packages/cache`** (depends on `@kol-fit/db` + `@kol-fit/twitter` interface types) OR keep it inside `apps/worker` — recommend a small **`packages/cache`** so it's testable and reusable. It contains: the `CacheStore` interface + a Prisma-backed implementation, and the `withTwitterCache(provider, store, ttls)` decorator + a `UsageTrackingTwitterProvider` (or reuse the live provider's `getUsageStats()`).
- **Worker** constructs the providers, wraps the Twitter provider with caching, passes both providers into `runAnalysis(requestData, { twitter, llm })`, and after the run reads `getUsageStats()` off the providers to write `ProviderUsageLog` rows. The mock stays the default (caching is a harmless no-cost pass-through for the mock).
- `runAnalysis` already supports `options.twitter`/`options.llm` (Unit 13) — so the pipeline needs **no change** beyond consuming injected providers it already accepts.

## Caching Design

Cache **TwitterAPI.io** reads only (profiles, tweets, engagement) — the cost/volume driver, and cleanly keyable.

- **`CacheStore` interface** (injectable, so it's testable offline without a DB):
  ```ts
  interface CacheStore {
    get(key: string): Promise<{ payload: unknown; fetchedAt: Date } | null>; // null when absent or expired
    set(key: string, payload: unknown, ttlSeconds: number): Promise<void>;
  }
  ```
  Implementations: `PrismaCacheStore` (DB-backed, below) and an in-memory store for tests.
- **`withTwitterCache(inner: TwitterProvider, store, ttls)`** — a decorator implementing `TwitterProvider`. Each method:
  1. builds a cache key, 2. `store.get(key)` → on a valid (unexpired) hit, return the cached normalized value (already the shared type), 3. on miss, call `inner.*`, then `store.set(key, result, ttl)` and return. Cache stores the **normalized** shared-type output (small, provider-neutral), not raw payloads (Invariant 15).
- **Cache keys** (stable, versioned so a shape change invalidates): `tw:v1:profile:<handle>`, `tw:v1:tweets:<handle>:<limit>`, `tw:v1:replies:<handle>:<limit>` (userReplies), `tw:v1:tweetReplies:<tweetId>:<limit>`, `tw:v1:tweetQuotes:<tweetId>:<limit>`, `tw:v1:retweeters:<tweetId>:<limit>`, `tw:v1:followers:<handle>:<limit>`. Handles/queries normalized (lowercased) into the key.
- **TTLs** (env-overridable; defaults reflect data volatility): profiles ~24h, tweets/engagement ~6h. A single default (e.g. `CACHE_TTL_SECONDS`, default 21600) with per-kind overrides is fine. TTL 0 / a `CACHE_ENABLED=false` flag disables caching (pass-through) for testing/forcing fresh data.
- **Cache-miss-safe:** any `store` error (get or set) is swallowed and treated as a miss/no-op — caching must **never** fail an analysis. The decorator logs at debug and falls through to the live call.

## Prisma Schema Change (justified — stop-and-confirm before implementing)

A cache needs storage. `ProviderUsageLog` already exists (usage logging needs no schema change), but there is **no provider-data cache table**. Add one:

```prisma
model ProviderCache {
  key       String   @id            // e.g. "tw:v1:profile:uniswap"
  provider  String                  // "twitterapi"
  payload   Json                    // normalized shared-type value
  fetchedAt DateTime @default(now()) @db.Timestamptz
  expiresAt DateTime @db.Timestamptz
  @@index([expiresAt])
}
```

- Justification: DB-backed caching (architecture.md → *Cache*) requires a durable, handle/tweet-keyed store reusable **across** requests; the existing `OrgProfile`/`KolProfile` tables are per-`requestId` snapshots (unique `requestId`), not a cross-request cache. A single generic `ProviderCache` key-value table is minimal and covers profiles/tweets/engagement.
- This is the one required schema change. It is additive (new table only, no changes to existing models). Applied via `prisma db push` / a migration. **Per the standing rule, confirm this schema addition before implementing.**

## Cost / Sampling Controls

1. **Env-overridable caps.** Replace the frozen `ANALYSIS_CAPS` usage with a `resolveCaps(overrides?)` (in `packages/shared` or `packages/analysis`) that layers env overrides over the defaults: `ANALYSIS_KOL_POSTS`, `ANALYSIS_KOL_REPLIES`, `ANALYSIS_TOP_POSTS`, `ANALYSIS_REPLIES_PER_POST`, `ANALYSIS_QUOTES_PER_POST`, `ANALYSIS_RETWEETERS_PER_POST`, `ANALYSIS_MAX_ENGAGED`. Invalid/empty → default. The pipeline takes `caps` via `options.caps` (already supported) — the worker passes `resolveCaps()`. Lower caps → fewer Twitter calls + cheaper runs, tunable without touching pipeline logic (architecture.md requirement).
2. **Audience-classification sampling improvement.** Unit 17 caps OpenAI audience classification at `OPENAI_AUDIENCE_CLASSIFICATION_LIMIT` (default 300) via a blunt **first-N** slice. Replace first-N with **representative sampling** — e.g. proportional across engagement `source` (REPLY/QUOTE/RETWEET) and/or dedup already applied — so the classified sample better reflects the full engaged set. Deterministic (seeded) so runs stay reproducible. `engagedAccountsClassified` (already recorded, Unit 17) continues to capture the classified count vs total.
3. **(Optional/deferred)** per-request or per-workspace sample-size settings surfaced in the API/UI — not required by the build-plan verification; env-level operator control satisfies "adjustable." Flagged as a future extension (needs schema + API + UI).

## Provider Usage Logging

- The live providers already expose `getUsageStats()` (`packages/twitter` `UsageStats`: requests/pages/users/tweets + `byEndpoint`; `packages/llm` `LlmUsageStats`: requests/input/output/total tokens + `byMethod`). The **mock** providers don't (no cost) — logging is skipped/zeroed for mock.
- After a run, the worker writes `ProviderUsageLog` rows (existing table) linked to `requestId`/`reportId`: one per provider (`provider="twitterapi"|"openai"`, `operation="analysis"` or per-endpoint/method breakdown in `meta`), with `requests`, `tokensIn`/`tokensOut` (OpenAI), and `meta` (the `byEndpoint`/`byMethod` maps + cache hit/miss counts).
- **`costUsd` (best-effort estimate):** optionally compute from a small price table (Twitter ≈ $0.15/1k tweets, $0.18/1k profiles; OpenAI per-token by `LLM_MODEL`). Prices drift and are model-specific, so this is best-effort and clearly-marked; log raw `requests`/`tokens` unconditionally (those are the source of truth). Recommend: log raw usage always; `costUsd` behind a small, documented price map.
- Usage-logging failures are swallowed (never fail a completed analysis).

## Configuration / Environment Variables

- `CACHE_ENABLED` (default true), `CACHE_TTL_SECONDS` (default 21600) — optionally `CACHE_TTL_PROFILE_SECONDS` / `CACHE_TTL_TWEETS_SECONDS`.
- `ANALYSIS_*` cap overrides (listed above) — all optional, default to `ANALYSIS_CAPS`.
- Reuse existing `OPENAI_AUDIENCE_CLASSIFICATION_LIMIT` for the classification cap.
- Document all in `.env.example`. No new secrets.

## Integration Behavior (worker)

`apps/worker/src/handlers/analysis-run.ts`:
- Build providers: `const twitter = withTwitterCache(createTwitterProvider(), cacheStore, ttls)`, `const llm = createLlmProvider()`.
- `const caps = resolveCaps()`.
- `await runAnalysis(requestData, { twitter, llm, caps })` — pipeline unchanged in behavior, just fed injected providers + caps.
- After success (and even on failure, best-effort): write `ProviderUsageLog` from `twitter.getUsageStats()` / `llm.getUsageStats()` (the caching wrapper forwards `getUsageStats` from the inner live provider + adds cache hit/miss counts).
- Preserve QUEUED→RUNNING→COMPLETED/FAILED transitions + upsert idempotency (unchanged).

## Error Handling

- Cache get/set errors → treated as miss/no-op; analysis proceeds against the live provider. Cache never fails a run (Invariant 8).
- Usage-logging errors → logged, swallowed (a saved report must not be lost because a usage row failed).
- Expired entries: `get` returns null when `expiresAt < now`; a lazy cleanup (delete-on-read or a periodic prune) keeps the table bounded — recommend delete-expired-on-miss + an optional prune query; no cron required this unit.
- No secrets/PII in cache payloads (normalized public profile/tweet metadata only) or usage logs.

## Implementation Steps

1. **Schema:** add `ProviderCache` model; `prisma db push` (or migration). (Confirm first.)
2. **`packages/cache`** (`workspace:*` deps `@kol-fit/db`, `@kol-fit/twitter`, `@kol-fit/shared`): `CacheStore` interface + `PrismaCacheStore` + `InMemoryCacheStore`; `withTwitterCache(provider, store, ttls)` decorator (keys, TTLs, miss-safe, forwards `getUsageStats` + tracks hits/misses); `resolveCacheConfig()` from env.
3. **Caps:** `resolveCaps(overrides?)` reading `ANALYSIS_*` env → `AnalysisCaps` (in `packages/shared` or `packages/analysis`); keep `ANALYSIS_CAPS` as the defaults. Update caps.ts comment.
4. **Sampling:** representative deterministic audience sampling in the OpenAI provider (replace the first-N slice) — `packages/llm` only; keep `OPENAI_AUDIENCE_CLASSIFICATION_LIMIT`.
5. **Usage logging:** a worker helper `logProviderUsage(prisma, { requestId, reportId }, twitter, llm)` writing `ProviderUsageLog`; optional `estimateCostUsd` price map.
6. **Worker wiring:** construct cached provider + caps, pass to `runAnalysis`, log usage after (best-effort).
7. **`.env.example`** + `context/architecture.md` (note the `ProviderCache` table + that caps are now env-overridable).
8. Confirm **no** API-route/UI change; pipeline shape unchanged (only fed injected providers/caps).

## Dependencies

- `packages/cache`: `@kol-fit/db`, `@kol-fit/twitter`, `@kol-fit/shared` (all workspace). No new npm packages (Prisma already present). `apps/worker` gains `@kol-fit/cache`.
- No live-network/SDK deps.

## Verification Checklist

Offline (primary — no network/DB; injected `InMemoryCacheStore` + mock providers):
- [ ] `pnpm build` + `pnpm check` green.
- [ ] **Cache hit/miss:** `withTwitterCache(mock, memStore)` — first call hits the inner provider + writes cache; a second identical call returns the cached value **without** calling the inner provider (spy count); different args → separate keys → miss.
- [ ] **TTL:** an entry past `ttlSeconds` (injected clock) → treated as miss (re-fetch); `CACHE_ENABLED=false` → always pass-through.
- [ ] **Miss-safe:** a throwing `store` → the call still returns the live value (no throw).
- [ ] **Caps:** `resolveCaps()` returns defaults with no env; `ANALYSIS_MAX_ENGAGED=100` (etc.) overrides; invalid/empty → default.
- [ ] **Sampling:** representative sampler is deterministic (same input → same sample) and returns ≤ cap; distribution over `source` is more balanced than first-N on a skewed input.
- [ ] **Usage aggregation:** `logProviderUsage` builds correct `ProviderUsageLog` fields from `getUsageStats()` (requests/tokens/meta); mock providers → zero/skipped.

Online (disk-light throwaway Postgres, mock providers — no billable calls):
- [ ] **Repeated requests reuse cache:** two analyses for the same handle pair → the second populates far fewer/zero `ProviderCache` writes for the shared keys and reuses rows (assert cache rows created once, `fetchedAt` unchanged on reuse).
- [ ] **Caps control sampling:** with `ANALYSIS_MAX_ENGAGED` lowered, the persisted `Report.sampleSize.engagedAccounts` drops accordingly.
- [ ] **Usage logs saved:** `ProviderUsageLog` rows exist for the run, linked to `requestId`/`reportId`.
- [ ] Worker transitions + report upsert idempotency unchanged.

Optional live (only with keys, explicit approval, never CI): a real re-run of the same pair is materially cheaper/faster on the 2nd run (cache hits) — manual, billable.

Scope guardrails:
- [ ] Pipeline (`packages/analysis`) + providers (`packages/twitter`/`packages/llm`) stay `@kol-fit/db`-free; caching/usage-logging live in `packages/cache`/worker.
- [ ] Only the `ProviderCache` schema addition (confirmed first); no other model changes; no API-route/UI change.
- [ ] `context/progress-tracker.md` updated once implemented. No commits.

## Open Questions / Design Decisions

- **Cache store shape:** generic `ProviderCache` key-value table (recommended, minimal) vs typed per-kind tables. Recommend the generic KV table.
- **TTLs:** profiles 24h / tweets+engagement 6h defaults — confirm, or a single 6h default.
- **`costUsd`:** compute best-effort from a price map, or log raw requests/tokens only (and derive cost in reporting later)? Recommend raw always + optional estimate.
- **Per-request/workspace sample-size settings** (UI-surfaced) — defer to a later unit (needs schema+API+UI), or include a minimal request-level override now? Recommend defer; env controls satisfy the build-plan verification.
- **Representative sampling** algorithm — proportional-by-source is the simplest deterministic improvement over first-N; confirm that's sufficient vs anything fancier.
