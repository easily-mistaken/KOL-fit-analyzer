# Unit 29G: Severity-Tiered Risk Caps + Synthetic Negative Controls

Part of the Unit 29 accuracy overhaul. Motivated by the user's v26 calibration
set (`context/krypto-kol-calibration-pairs-v26.md`), rule 6: risk severity
should map to verdict caps — Low → warning only; Moderate → max GOOD/OKAY;
High → max WEAK; **Severe → AVOID**. Today nothing can cap to AVOID, and
brand safety never gates at all — the five AVOID controls (airdrop-farm hub,
casino feed, raid bot, giveaway host, unverifiable-tips account) are
inexpressible.

## Gate changes (packages/scoring)

New constants in `weights.ts`; `RiskGateInput` gains `brandSafety`.

| Signal | Threshold | Cap |
|---|---|---|
| bot/farm risk | ≥ 85 (`BOT_GATE_OKAY`) | OKAY (existing) |
| bot/farm risk | ≥ 95 (`BOT_GATE_WEAK`) | WEAK (existing) |
| bot/farm risk | ≥ 97 (`BOT_GATE_AVOID`) | **AVOID** — overwhelming fake/farmed engagement (raid rings, farm hubs, giveaway audiences) |
| promo risk + unrelated > 0.5 | ≥ 85 (`PROMO_GATE_OKAY`) | OKAY (existing) |
| promo risk + unrelated > 0.5 | ≥ 95 (`PROMO_GATE_WEAK`) | WEAK — feed saturated with unrelated shills |
| brand safety | < 40 (`BRAND_GATE_WEAK`) | WEAK — multiple/serious confirmed flags |
| brand safety | < 20 (`BRAND_GATE_AVOID`) | **AVOID** — severe confirmed safety findings (casino/gambling mismatch, deceptive claims, phishing exposure, impersonation) |

Caps combine as the minimum. The 29F founder floor already yields whenever a
gate fires, so severe risk beats authority (rule 1's escape hatch). Promo
saturation alone still never reaches AVOID — rule 14: "promo-heavy accounts
can be WEAK rather than automatically AVOID" (awareness value retained).
All severity comes from *classified evidence* (audience buckets, safety
flags), never follower counts or raw engagement rate (rule 6's warning).

## Synthetic negative controls (fixtures, not live runs)

The 7 synthetic pairs are PATTERNS, not real accounts: the live runner skips
`synthetic: true` pairs; the patterns are encoded as scoring fixtures in
`scripts/checks/negative-controls.regression.cjs` (rule 14):

- Aave × AirdropFarmHub → farm/giveaway-dominated audience → AVOID.
- Ledger × CasinoBonusFeed → gambling + misleading + impersonation high
  flags → brand safety ~0 → AVOID despite reach.
- EigenLayer × EngagementRaidBot → overwhelming bots_spam share → AVOID.
- Phantom × MemeGiveawayHost → giveaway/phishing pattern → AVOID.
- Polymarket × UnverifiedSportsTips → deceptive claims + regulatory flags →
  AVOID even with real category overlap (keyword overlap must not defeat caps).
- chainlink × CryptoMacroSponsor → promo-heavy but disclosed → **WEAK, not
  AVOID** (low developer intent does the damage, not a hard cap).
- base × AltcoinDealsDesk → deal-seeking retail audience vs builder targets →
  WEAK via low match, no cap.

## Also in this unit

- `pairs.json` upgraded to the v26 set (20 real + 7 synthetic; Vitalik pair
  from the v12 set retained; `labelConfidence` recorded per pair).
- Runner skips synthetic pairs with an explanatory line.
- Recorded future units (not in scope): campaign-goal-conditional verdicts
  (rule 3), independence-vs-controllability fields (rule 11), prediction/
  gambling compliance gate beyond safety flags (rule 13).

## Verification

`pnpm build`; new `negative-controls.regression.cjs` (all 7 patterns land as
labeled; caps combine as min; founder floor loses to severe risk; promo-heavy
≠ AVOID) in `pnpm check`; existing suites stay green; mock calibrate run
skips synthetics and executes the 20 real pairs.
