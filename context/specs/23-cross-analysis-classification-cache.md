# Unit 23: Cross-Analysis Classification Reuse (LLM Cache)

## Goal

When an agency analyses the same KOL against several orgs (`A×B`, then `D×B`), or the same org against several KOLs (`A×B`, `A×C`), the system currently **recomputes the same expensive LLM classifications every time**. This unit caches those computed classifications so they're reused across analyses, cutting cost and time.

Motivating cost (from Unit 18, one live run): the **audience classification** alone is ~8 OpenAI calls over up to 300 engaged accounts, on top of ~100 TwitterAPI.io calls to fetch that engagement — and it depends **only on the KOL**, so `D×B` re-pays for the identical work already done in `A×B`.

What's reusable, and on what it depends:

| LLM call | Depends on | Reusable across |
| --- | --- | --- |
| `classifyAudienceAccounts` (biggest cost) | the KOL's engaged accounts | every `* × B` |
| `classifyKolContent` | the KOL's posts/replies | every `* × B` |
| `classifyOrgProfile` | the org profile + manual brief | every `A × *` (same brief) |
| `generateFitReport` | the **pair** (both sides + scores) | **not reusable — never cached** |

Unit 19 already caches the raw TwitterAPI.io reads (profiles 24h, tweets/engagement 6h) but deliberately **not** the LLM outputs. This unit extends caching **up to the computed-classification layer**, reusing Unit 19's storage and injection pattern.

## Design: content-addressed classification cache (recommended)

Rather than key by entity handle (which risks serving a stale 14-day-old classification for data that has since changed), key each cached classification by a **stable hash of its actual inputs** + model + a prompt/schema version. Properties:

- **Correct by construction.** Identical inputs → same key → reuse; any change to the inputs (different posts, different engaged accounts, different brief, different model) → different key → recompute. A cached result is only ever served for the *exact* inputs that produced it, so there is **no staleness/mismatch risk** and no "force refresh" UX needed.
- **Delivers the core scenario.** In the common flow — analysing KOL B against several orgs in the same session/day — B's Twitter reads are already cached by Unit 19, so each analysis feeds `classifyAudienceAccounts` / `classifyKolContent` the **identical** accounts/posts → cache hit → the ~8-call audience classification and the content classification are skipped. `A×*` reuses the org classification when the brief matches.
- **Composes with Unit 19.** Same-KOL reuse persists as long as B's engaged-account set is stable; operators who want longer reuse simply raise the Unit-19 tweets/engagement TTL (the account set stays stable → the classification key stays stable).
- Entries persist with a long TTL (**14 days**, configurable) so reuse spans days, not just the 6h Twitter window, whenever the inputs recur.

Alternative considered — **entity-keyed** (key by KOL handle + config, ignore input data): reuses even when the underlying data changed, but then serves possibly-stale classifications and needs staleness notes / a force-refresh control. Recommend content-addressed; flagged in Open Questions.

## Where it lives (mirrors Unit 19)

- **New `CachingLlmProvider` decorator in `packages/cache`** (`withLlmCache(inner, store, config)`), implementing `LlmProvider`. It wraps the three classification methods with cache get/set and **passes `generateFitReport` through uncached** (pair-specific). Miss-safe: any store error → treat as a miss and call the inner provider (caching never fails an analysis, Invariant 8). Forwards `model` and `getUsageStats()` (+ classification cache hit/miss counts).
- **Storage:** reuse the existing `ProviderCache` KV table + `PrismaCacheStore` (Unit 19). **No schema change.** Entries carry `provider: "llm"`.
- **Worker wiring:** `apps/worker/src/providers.ts` `buildProviders()` wraps the LLM provider (`withLlmCache(createLlmProvider(), new PrismaCacheStore("llm"), resolveClassificationCacheConfig())`) just as it already wraps the Twitter provider. Pass into `runAnalysis({ twitter, llm, caps })`.
- **Pipeline unchanged** (`packages/analysis` stays pure and `@kol-fit/db`-free; it already accepts an injected `llm`). **LLM provider interface unchanged** — the decorator derives keys from the existing input fields, so nothing new is threaded through the pipeline.

## Cache keys

Versioned namespace so a prompt/shape change invalidates cleanly. Key = `cls:v1:<method>:<sha256(canonical inputs)>`:

- **content:** hash of `{ handle(normalized), profileId, sorted post ids, sorted reply ids, model }`.
- **audience:** hash of `{ sorted engaged-account ids + their sources, audienceLimit (OPENAI_AUDIENCE_CLASSIFICATION_LIMIT), model }`. Account ids are **sorted** so fetch-order differences don't change the key.
- **org:** hash of `{ handle(normalized), profileId, sha256(websiteText), canonical(manualBrief), model }`.

Canonicalization uses a stable JSON serialization (sorted keys). Hashing uses Node `crypto` (no new dependency). Keeping ids (not full text) keeps keys small and stable.

## Read-time safety

On a hit, **re-validate** the cached payload against its shared Zod schema (`KolContentClassificationSchema` / `AudienceClassificationSchema` / `OrgClassificationSchema`) before returning; on failure treat it as a miss and recompute. This guards against any stored-shape drift and keeps Invariant 9 (validated data only) intact.

## Configuration (env)

- `CLASSIFICATION_CACHE_ENABLED` (default `true`; `false` → pass-through).
- `CLASSIFICATION_CACHE_TTL_SECONDS` (default `1209600` = 14 days).
- Optional per-kind overrides `CLASSIFICATION_CACHE_TTL_AUDIENCE_SECONDS` / `_CONTENT_SECONDS` / `_ORG_SECONDS` (default to the base).
- Reuses existing `OPENAI_AUDIENCE_CLASSIFICATION_LIMIT` (already part of the audience key).
- Documented in `.env.example`. No new secrets.

## Usage logging

Extend `logProviderUsage` (Unit 19) so the LLM `ProviderUsageLog.meta` records classification cache hits/misses (per method), alongside the existing token counts — so the savings are observable. Cache-served classifications naturally reduce the live LLM call/token counts.

## Error handling

- Store get/set errors → miss/no-op; the analysis proceeds against the live provider (never fails a run).
- Cached-payload validation failure → miss + recompute.
- Usage-logging failures stay best-effort/swallowed (Unit 19).
- No secrets/PII in keys (ids/hashes only) or payloads (already validated public classifications).

## Implementation Steps

1. `packages/cache`: `withLlmCache` + `CachingLlmProvider` (keying, hashing via `crypto`, miss-safe, re-validate on read, forward `model`/`getUsageStats` + hit/miss counts); `resolveClassificationCacheConfig()`; a `CLASSIFICATION_PROMPT_VERSION` constant for the key namespace.
2. `apps/worker/src/providers.ts`: wrap the LLM provider with `withLlmCache` in `buildProviders()`; surface its stats to `logProviderUsage`.
3. `apps/worker` usage logging: add classification cache hit/miss to the LLM usage `meta`.
4. `.env.example` + `context/architecture.md` (extend the Unit-19 Cache note: LLM classifications are now content-addressed and cached in `ProviderCache`, `generateFitReport` excluded).
5. New regression check `scripts/checks/*.cjs` (wired into `pnpm check`): with an injected in-memory store + a spy LLM provider, assert (a) identical inputs → second call served from cache (inner not called), (b) changed inputs (a different account id / brief / model) → miss, (c) `generateFitReport` never cached, (d) miss-safe on a throwing store, (e) key stability regardless of account order.
6. `context/progress-tracker.md`.

## Dependencies

- No new npm packages (Node `crypto`, existing `@kol-fit/db`/`@kol-fit/shared`/`@kol-fit/llm` types). `apps/worker` already depends on `@kol-fit/cache`.
- No live-network work; no schema change; no interface/pipeline change.

## Verification

Offline (primary — `pnpm build` + `pnpm check`):
- [ ] Build + all regression checks green (incl. the new one).
- [ ] Content/audience/org: identical input → inner provider called once across two calls; cache hit returns the same validated value; different input → recompute; `generateFitReport` always calls through.
- [ ] Account-order independence; `CLASSIFICATION_CACHE_ENABLED=false` → always pass-through; throwing store → still returns the live value.

Online (disk-light, local Postgres, mock providers — no billable calls):
- [ ] Run `A×B` then `D×B`: the second run creates **no new** `cls:v1:content:*` / `cls:v1:audience:*` rows for B and reuses them (assert row `fetchedAt` unchanged); usage `meta` shows classification cache hits.
- [ ] `A×B` then `A×C` reuses the org classification (same brief).

Optional live (keys + explicit approval, never CI): re-running the same KOL against a second org is materially cheaper (fewer OpenAI calls) — manual, billable.

Scope guardrails:
- [ ] Pipeline (`packages/analysis`) + providers stay `@kol-fit/db`-free; caching lives in `packages/cache` + worker.
- [ ] No schema change (reuse `ProviderCache`); no LLM-interface/pipeline change; `generateFitReport` never cached.
- [ ] Cached results only ever served for identical inputs (content-addressed) — no cross-pair leakage.
- [ ] `.env.example`, `architecture.md`, `progress-tracker.md` updated. One commit after verification.

## Open Questions / Decisions (recommended defaults in place)

- **Keying:** content-addressed (recommended — correct, no staleness, delivers the same-session scenario) vs entity-keyed (longer reuse across data churn, but needs staleness handling). Recommend content-addressed.
- **TTL:** 14 days flat (recommended) vs shorter for audience. With content-addressing, staleness isn't a correctness issue, so a single long TTL is fine; confirm 14d (the user said "~15 days").
- **Scope:** cache all three classifications (recommended — one uniform decorator) vs audience-only (the dominant cost). Recommend all three.
- **Reuse note in the report:** optionally surface "some classifications reused from cache" in evidence/usage. Recommend usage-log only (keep the report clean); confirm.
