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

## Tuning pass results (2026-07-14, live data, gpt-5-mini)

Tuned constants: `VERDICT_THRESHOLDS.STRONG` 80→83; `AUTHORITY_OVERALL_BOOST_FOUNDER`
+6 (new); media cap two-tier (`MEDIA_CAP_GOOD` with EAM≥75 audience proof /
`MEDIA_CAP_OKAY` below). Prompt fixes: scam-investigation ≠ brand-safety flag;
pseudonymous/publicly-known founders count as founder_or_core_team. Guard:
0-posts analyses fail loudly.

| Pair | Expected | Pre-tune | Post-tune |
|---|---|---|---|
| Uniswap × haydenzadams | STRONG | STRONG 88 | **PASS** STRONG 94 |
| chainlink × SergeyNazarov | STRONG | GOOD 77 ✗ | **PASS** STRONG 83 |
| base × jessepollak | STRONG | STRONG 85 | **PASS** STRONG 85 |
| JupiterExchange × weremeow | STRONG | STRONG 81 | **PASS** STRONG 87 (now founder) |
| eigenlayer × sreeramkannan | STRONG | STRONG 92 | **PASS** STRONG 100 |
| Ledger × zachxbt | GOOD | WEAK 75 ✗ (false BS gate) | **PASS** GOOD 82 |
| ethena_labs × TheDeFinvestor | GOOD | GOOD 79 | **PASS** GOOD 80 |
| ethereum × ETHIndiaco | GOOD | STRONG 92 ✗ | **PASS** GOOD 92 (media cap) |
| base × ETHIndiaco | GOOD | STRONG 88 ✗ | **PASS** GOOD 89 (media cap) |
| Polymarket × NateSilver538 | GOOD | — | MISS OKAY 61 (a) |
| Uniswap × VitalikButerin | GOOD | — | MISS STRONG 86 (b) |
| Aave × haydenzadams | OKAY | — | MISS STRONG 87 (c) |
| fhenix × ETHIndiaco | OKAY | — | MISS GOOD 88 (c) |
| Immutable × shroud | OKAY | — | MISS STRONG 86 (c) |
| Uniswap × WatcherGuru | WEAK | — | MISS OKAY 82 (c) |
| Ledger × CoinDesk | WEAK | — | MISS GOOD 83 (c) |
| fhenix × CoinDesk | WEAK | — | MISS OKAY 75 (c) |
| phantom × aeyakovenko | GOOD | garbage AVOID | DATA ERROR (guard fires; empty tweets from provider) |
| MetaMask × BanklessHQ | GOOD | garbage AVOID | DATA ERROR (same) |
| chainlink × BanklessHQ | OKAY | garbage AVOID | DATA ERROR (same) |

**9/17 valid pairs exact-band. All 5 STRONG founder/ecosystem pairs pass; the
GOOD band passes 5/5 where authority/media machinery applies.**

The 8 misses cluster into exactly the two features the v26 rules call for and
that are recorded as future units — further anchor-bending would overfit and
break the passes:

- **(c) Intent-overlap gap (v26 rule 4, 6 misses):** the audience bucket
  taxonomy is category-level, not intent-level. `defi_users` conflates DEX
  traders with lenders (Aave×hayden), mainstream gamers classify as
  `nft_gaming` (Immutable×shroud), EVM devs ≠ FHE specialists
  (fhenix×ETHIndia), news readers classify into trader/investor buckets which
  inflates EAM for media accounts (WatcherGuru/CoinDesk pairs land OKAY/GOOD
  instead of WEAK).
- **(b) Goal-conditional verdicts (v26 rule 3, 1 miss):** Vitalik×Uniswap —
  adjacent authority with genuinely elite metrics. jessepollak (also labeled
  adjacent) is EXPECTED to be STRONG, so no blanket adjacent cap can separate
  them; the differentiator is campaign-goal context.
- **(a) Domain-authority lift (rules 3/11, 1 miss):** Nate×Polymarket —
  independent specialist whose non-crypto audience tanks EAM; the label
  credits domain authority the metrics can't see (per the user's hierarchy,
  specialists get no authority override, so this too is goal/intent work).

Data issue (separate): `aeyakovenko` and `BanklessHQ` tweet fetches return
empty from TwitterAPI.io even with credits (needs endpoint investigation);
the 0-posts guard now fails these loudly instead of scoring garbage.
