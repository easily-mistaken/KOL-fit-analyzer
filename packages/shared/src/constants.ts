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
// v6 (Unit 51): expected reach's per-post volume switched from MEAN to MEDIAN
// over original posts — one viral outlier no longer inflates the "typical
// post" number brands price against. The fit score is untouched, but the
// reach dial changes for the same inputs, so reuse must re-run.
// v7 (Unit 52): org target inference now recognises CONSUMER / RETAIL crypto
// products (prediction markets, exchanges, wallets, launchpads) and targets the
// retail participant (trader + enthusiast across crypto domains) instead of
// defaulting trading-sounding brands to sophisticated / institutional
// investors. The engaged-audience match, and therefore the fit score, changes
// for the same creator against such brands, so reuse must re-run. (The org
// PROMPT half of this change rides ORG_PROMPT_REV in packages/cache, not NS, so
// the expensive audience cache is preserved; this bump only busts report reuse.)
// v8 (Unit 53): the report-narrative prompt now receives the deterministic
// verdict + score reasons and must write a narrative that AGREES with them.
// Before, the model never saw the verdict and could write "solid match" prose
// on an AVOID report. Scores are unchanged, but the narrative for the same
// inputs is, so reuse must re-run rather than serve a contradictory report.
// (The report call is never LLM-cached, so no cache rev is involved.)
export const SCORING_VERSION = 8;
