# Unit 29D: Pipeline Parallelism + Latency Budget

Part of the Unit 29 accuracy overhaul (`29-analysis-accuracy-overhaul.md`).
Goal: cut live analysis wall-time (~5–7 min at Unit 18) toward the ~2–2.5 min
p50 target. The user prioritized time over cost ("users won't stay that long").
No sampling-depth reduction except the retweeter rebalance; no provider,
schema, scoring, or API changes.

## Where the time goes (live path)

1. **Per-post engagement fetches are sequential**: 20 top posts × (replies ∥
   quotes ∥ retweeters) = 20 sequential round-trip batches — the dominant
   Twitter cost.
2. Website/docs ingestion runs BEFORE any Twitter fetch (serial).
3. Org classification and KOL content classification run serially.
4. (Audience batches already 3-concurrent; assessContentFit already parallel
   with audience classification — done in 29B/29C.)

## Changes (packages/analysis + shared caps)

1. **Bounded-concurrency engagement fetches**: `mapConcurrent` over top posts,
   `DEFAULT_ENGAGEMENT_FETCH_CONCURRENCY = 6` posts in flight (each post still
   fires its 3 engagement calls in parallel). Override via
   `RunAnalysisOptions.engagementConcurrency` or
   `ANALYSIS_ENGAGEMENT_FETCH_CONCURRENCY` env. Results are index-ordered, so
   `collectEngagedAccounts` sees the exact same group order as the sequential
   version — **byte-identical output** (determinism preserved).
2. **Ingestion overlaps the Twitter fetch**: the ingest promise starts first
   and is awaited only where its result is needed (org classification).
3. **Org ∥ KOL content classification**: independent LLM calls now run in
   `Promise.all`.
4. **Caps rebalance**: `retweetersPerPost` 100 → 50 (retweets are the weakest
   signal — 29C weights them 0.5 — and retweeters are the most numerous,
   least-informative fetch). `architecture.md` caps table updated. Env
   override unchanged for anyone who wants 100 back.

Expected effect (live, 20 posts): Twitter engagement phase ~20 sequential
batches → ~4; org+content LLM serial pair → 1; ingestion off the critical
path. Combined with 29B's concurrent audience batches this targets the
~2–2.5 min p50.

## Out of scope

Worker changes (it already passes providers/caps), provider-level rate-limit
tuning, streaming per-stage progress events (future option), 29E calibration.

## Verification

`pnpm build`; new `scripts/checks/pipeline-latency.regression.cjs` in
`pnpm check` (injected delayed providers, offline): engagement fetches
overlap across posts (in-flight > one post's 3 calls) and honor
`engagementConcurrency: 1` (≤ 3 in flight); parallel output byte-identical
to a concurrency-1 run; org/content LLM calls overlap; ingestion overlaps
Twitter; `resolveCaps()` default retweetersPerPost = 50 with env override
still working. Mock pipeline E2E stays deterministic + valid.
