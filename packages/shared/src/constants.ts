// Product-level constants shared across web, worker, and packages.

export const APP_NAME = "OverlapX";

// Bumped whenever the FitReport shape changes; persisted with every report
// (Report.reportSchemaVersion in the DB) so old reports remain interpretable.
export const REPORT_SCHEMA_VERSION = 1;

// --- Staleness control -------------------------------------------------------
// The scoring ALGORITHM version, distinct from the report SHAPE version above:
// v3 can produce a different score from identical inputs without the FitReport
// shape changing at all. Stamped on every Report (Report.scoringVersion) and
// matched by findReusableAnalysis, so a report produced by an older algorithm
// can never be served as an instant-reuse hit — the submit re-runs instead.
//
// BUMP THIS on any change to weights, gates, verdict rules, or metric formulas.
// That is the whole ritual: reuse invalidates itself, no DB purge required.
//
// It does NOT invalidate the classification cache. That layer caches the LLM's
// AUDIENCE/FIT payloads, which survive a pure re-weighting untouched — coupling
// them would burn an OpenAI re-classify on every calibration tweak. Bump `NS` in
// packages/cache/src/llm-cache.ts instead, and only when the classification
// SCHEMA or PROMPT changes (adding an optional field counts: an old payload
// still passes safeParse and is served as a silent hit — the cls:v2 -> v3
// incident, 2026-07-18).
// v4 (Unit 43): the audience taxonomy split into role / domain / quality, and
// matching became two-dimensional (role AND domain, see weightedMatch). Same
// inputs now produce different scores, so every pre-v4 report must re-run
// rather than be served as an instant-reuse hit.
// v5 (Unit 48): reposts (native retweets) are excluded from content and
// engagement analysis, and the overall fit is multiplied by down-only activity
// (days since last original post) and originality (repost share) factors. Same
// inputs now produce different scores AND different sampled data.
// (Amended same-day before any v5 report existed, so no bump: the originality
// penalty is relieved by original cadence — reposting freely is fine while the
// creator keeps shipping ~3+ original posts/week; the penalty targets accounts
// whose own voice has thinned.)
export const SCORING_VERSION = 5;
