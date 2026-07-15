# Unit 30: Audience Intent Overlap (category ≠ intent)

Motivated by v26 rule 4 ("same vertical does not mean same user intent") and
the 29E live calibration: 6 of 8 remaining misses trace to the audience bucket
taxonomy being category-level. `defi_users` conflates DEX traders with
lenders (Aave×hayden STRONG-vs-OKAY), mainstream gamers classify as
`nft_gaming` (Immutable×shroud STRONG-vs-OKAY), EVM builders ≠ FHE
specialists (fhenix×ETHIndia GOOD-vs-OKAY), and news readers classify into
trader/investor buckets, inflating media pairs (WatcherGuru, CoinDesk ×2 —
all expected WEAK). A 7th miss (Polymarket×Nate OKAY-61-vs-GOOD) is the same
gap inverted: a forecasting audience has HIGH prediction-market intent but
sits in non-crypto buckets.

## Design

**One new bounded rubric dimension, not a taxonomy rewrite.** The 15-bucket
enum stays (schema/UI/cache stability). The pair-specific `assessContentFit`
call gains `audienceIntentOverlap: 0-5` — "does what this KOL's engaged
audience actually DOES/SEEKS match what this org needs users to do?" — with
the v26 rule-4 contrasts verbatim in the prompt (DEX trader vs lender;
borrower vs yield depositor; retail wallet user vs multisig admin; mainstream
gamer vs NFT trader; crypto reader vs protocol developer; forecaster vs
sports-betting user). Judged from the KOL's identity/content, so the call
stays parallel to audience classification (no latency or cache coupling).

## Scoring consumption (weights.ts constants)

- **EAM v3**: `EAM = clampRound(max(curve(matchedShare) × INTENT_DAMP[i],
  INTENT_FLOOR[i]))`.
  - `INTENT_DAMP = {0: .3, 1: .4, 2: .5, 3: 1, 4: 1, 5: 1}` — damping ONLY on
    clear mismatch (≤2). Intent 3 is neutral so heterogeneous-but-plausible
    audiences (chainlink×Sergey) are untouched.
  - `INTENT_FLOOR = {0..2: 0, 3: 0, 4: 55, 5: 70}` — high intent rescues
    audiences the category buckets under-count (Nate's forecasters).
  - Assessment absent → damp 1 / floor 0 (fallback unchanged). Reasons state
    the adjustment. `campaign_goal_fit`'s EAM proxy inherits automatically.
- **Media cap becomes intent-aware** (`applyAuthorityRules` ctx gains
  `intentOverlap`): media_or_news caps at **WEAK when intent ≤ 2** (readers
  without product intent — reach without fit), **GOOD when EAM ≥ 75 AND
  intent ≥ 4** (proven audience with real intent, still never STRONG),
  **OKAY otherwise**. Unknown intent behaves like v2 (EAM-only tiers).

## Predicted calibration effect (validated by a live re-score)

Fixes expected: Aave×hayden → OKAY, Immutable×shroud → OKAY,
fhenix×ETHIndiaco → OKAY (media tier, intent 3), Uniswap×WatcherGuru → WEAK,
Ledger×CoinDesk → WEAK, fhenix×CoinDesk → WEAK, Polymarket×Nate → GOOD
(floor). Must NOT break the 9 passes (founder/specialist pairs rate intent
3-5). Vitalik×Uniswap remains the one expected miss (goal-conditional unit).

## Scope

shared `ContentFitAssessmentSchema` += `audienceIntentOverlap` (optional
int 0-5); OpenAI `CONTENT_FIT_SCHEMA` + prompt (required in strict schema);
mock (deterministic heuristic); scoring (weights tables, EAM v3, media-cap
tiers); fit cache purge (prompt/schema changed — old payloads are stale);
regression check `intent-overlap.regression.cjs`; live re-score to validate
(fit + narrative calls only — Twitter/audience/content all cached).

Out of scope: bucket taxonomy changes, goal-conditional verdicts (next),
media scoring (Unit 31).

## Live validation results (2026-07-15, two iterations)

Iteration 1 exposed a hedging failure mode (the model defaulted to 3 —
"plausible" — for exactly the mismatch cases needing ≤2) and relationship
flicker on the pseudonymous founder. Iteration 2 added the ANTI-HEDGE rule,
an identity-first relationship check, `reasoningEffort: "low"` on the fit
call, and `LLM_MODEL_FIT` tiering (stronger model for the one judgment call;
fit cache keys on the judging model).

**Final: 13/17 valid pairs exact-band (was 9 before Unit 30):**

- Fixed by intent: Immutable×shroud OKAY 61 ✓ (intent 2), Uniswap×WatcherGuru
  WEAK 60 ✓ (media+intent 2), Ledger×CoinDesk WEAK 61 ✓, fhenix×CoinDesk
  WEAK 56 ✓, Polymarket×Nate GOOD 71 ✓ (intent-4 floor).
- Held: all founder STRONG pairs, zachxbt GOOD 82, ethena GOOD 79, both
  ETHIndia GOOD (media cap).

**Residual misses (4), with causes:**

1. Uniswap×VitalikButerin STRONG 85 vs GOOD — structural (goal-conditional
   verdicts, rule 3). Known, accepted.
2. JupiterExchange×meow GOOD 82 vs STRONG — **model-knowledge bound**:
   gpt-5-mini does not reliably know the pseudonymous founder (relationship
   flickers founder↔none between runs; no boost → 1 point under the STRONG
   threshold). Mitigations available: set `LLM_MODEL_FIT` to a stronger
   model, or (future product feature) let the org declare official/founder
   accounts in the brief.
3. Aave×haydenzadams GOOD 65 vs OKAY — intent 2 damping landed it EXACTLY on
   the GOOD lower bound (65). Within one point / one jitter notch.
4. fhenix×ETHIndiaco GOOD 86 vs OKAY — intent flickers 3↔4 between runs
   (genuinely ambiguous: EVM builders' FHE intent; the label itself is
   Medium-confidence). intent 3 → OKAY (passed iteration 1), 4 → GOOD.

Tuning stopped here deliberately: 3 of 4 misses sit within ±1 rubric-point /
±1 score-point of their boundary — chasing them with global constants would
overfit. The residual levers are `LLM_MODEL_FIT` (knowledge/jitter) and the
goal-conditional unit (Vitalik).
