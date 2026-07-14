# Unit 29E: Calibration Harness + Tuning

Part of the Unit 29 accuracy overhaul (`29-analysis-accuracy-overhaul.md`).
Two halves: (1) the **calibration runner** (buildable now), (2) the **tuning
pass** against the user's ground-truth pairs (blocked until the user supplies
them; only Uniswap × haydenzadams = STRONG is recorded so far).

## Ground-truth pairs file

`scripts/calibration/pairs.json`: `{ pairs: [{ orgHandle, kolHandle,
expected, notes?, addedAt? }] }`. `expected` accepts:

- exact verdict: `"STRONG"`
- at-least: `"GOOD+"` (GOOD or better)
- at-most: `"WEAK-"` (WEAK or worse)
- a set: `"GOOD|STRONG"`

## Runner (`scripts/calibration/run-pairs.cjs`, `pnpm calibrate`)

- Loads root `.env` (tiny built-in parser — no new deps), builds providers
  exactly like the worker: env-selected Twitter/LLM providers wrapped in the
  Prisma-backed caches when the DB is reachable (falls back to in-memory;
  cache errors are miss-safe by design). Cache-warm re-runs are near-free +
  deterministic — the tuning loop (edit `weights.ts` anchors → `pnpm build`
  → `pnpm calibrate`) re-scores without re-spending on LLM/Twitter.
- **Live-spend guard**: if either provider resolves to a live kind
  (`twitterapi`/`openai`), the runner ABORTS unless `--live` is passed —
  calibration against real KOLs is inherently billable and must be explicit.
  Mock mode runs freely but prints a loud "results not meaningful" banner.
- Runs pairs sequentially through `runAnalysis` (same caps resolution as the
  worker), printing per pair: expected vs actual verdict (PASS/MISS), overall,
  all 8 component scores, confidence, sample sizes, and wall-time (doubles as
  the 29D latency confirmation on live runs).
- Optional filter: `pnpm calibrate -- uniswap` runs only pairs whose handles
  match the substring.
- Writes `scripts/calibration/last-run.json` (gitignored) with the full
  structured results for diffing between tuning iterations.
- Exit code 1 when any pair misses (usable in a manual tuning loop; NOT wired
  into `pnpm check` — it can hit live providers and is not hermetic).

## Tuning pass (pending pairs)

With ≥6 pairs: run live once (cache-warms), then iterate on `weights.ts`
anchors/gates until all pairs land inside their expected ranges; record the
final anchor set + per-pair table in this spec and the progress tracker.

## Verification (runner half)

`pnpm build`; offline mock-mode run executes the recorded pair end-to-end,
prints the table + mock banner, writes `last-run.json`, and the expected-
matcher unit-behavior (exact/plus/minus/set) is exercised via a self-test
flag `--selftest` (pure, no pipeline).
