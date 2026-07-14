# Verified 26-Pair Calibration Set (v26, supersedes-and-extends the 12-pair set)

Received 2026-07-14. Interpretation note: **Confidence means confidence in the
calibration label**, not confidence that a campaign will perform well. The
verdict assumes a normal, product-relevant campaign. A sharply different
campaign goal can move some pairs by one band.

Synthetic handles are marked [SYNTHETIC] and are deliberately defined as
negative-control patterns. They are not real accounts or accusations against
real people. They are encoded as scoring-fixture regression checks
(scripts/checks/negative-controls.regression.cjs), NOT run live.

## Calibration table

| # | Org | KOL | Verdict | Label conf. | Fit type | Lesson |
|---|-----|-----|---------|-------------|----------|--------|
| 1 | @Uniswap | @haydenzadams | STRONG | High | Direct authority | Founder authority dominates ordinary audience noise |
| 2 | @chainlink | @SergeyNazarov | STRONG | High | Direct authority | Infra authority needs builder/protocol audience weighting |
| 3 | @base | @jessepollak | STRONG | High | Direct authority | Ecosystem creator highly authoritative for builder campaigns |
| 4 | @JupiterExchange | @weremeow | STRONG | High | Direct authority | Founder + direct trading-ecosystem alignment (pseudonymity ≠ discount) |
| 5 | @eigenlayer | @sreeramkannan | STRONG | High | Direct authority | Technical founder fit ≠ retail engagement standards |
| 6 | @phantom | @aeyakovenko | GOOD | High | Adjacent authority | Chain founder relevant to ecosystem wallet, not product-specific |
| 7 | @Ledger | @zachxbt | GOOD | High | Adjacent authority | Independent security authority valuable without being an endorser |
| 8 | @MetaMask | @BanklessHQ | GOOD | Medium | Broad media | Category-specialist media → strong wallet/DeFi awareness |
| 9 | @ethena_labs | @TheDeFinvestor | GOOD | Medium | Audience-only | Strong DeFi/yield overlap without org authority |
| 10 | @ethereum | @ETHIndiaco | GOOD | High | Adjacent authority | Regional ecosystem authority strong for Indian builder campaigns |
| 11 | @base | @ETHIndiaco | GOOD | Medium | Adjacent authority | Regional EVM builders relevant, not Base-specific |
| 12 | @Polymarket | @NateSilver538 | GOOD | High | Adjacent authority | Domain authority can outweigh limited crypto-native positioning |
| 13 | @Aave | @haydenzadams | OKAY | High | Adjacent authority | Same DeFi vertical ≠ identical user intent |
| 14 | @chainlink | @BanklessHQ | OKAY | Medium | Broad media | Ethereum/DeFi users ≠ oracle developers/buyers |
| 15 | @fhenix | @ETHIndiaco | OKAY | Medium | Audience-only | Builder overlap without specialist FHE fit |
| 16 | @Immutable | @shroud | OKAY | Medium | Audience-only | Gaming category matches; Web3 intent may not |
| 17 | @Uniswap | @WatcherGuru | WEAK | High | Broad media | Crypto-news reach ≠ targeted DEX fit |
| 18 | @Ledger | @CoinDesk | WEAK | High | Broad media | Editorial distribution ≠ wallet conversion |
| 19 | @fhenix | @CoinDesk | WEAK | High | Broad media | General readers too broad for specialist FHE adoption |
| 20 | @chainlink | [SYNTHETIC] @CryptoMacroSponsor | WEAK | High | Audience-only | Promo-heavy reach may retain awareness value but lack developer intent |
| 21 | @base | [SYNTHETIC] @AltcoinDealsDesk | WEAK | High | Audience-only | Deal-seeking retail poorly matched with builder acquisition |
| 22 | @Aave | [SYNTHETIC] @AirdropFarmHub | AVOID | High | Avoid-risk | Farming incentives ≠ lending adoption |
| 23 | @Ledger | [SYNTHETIC] @CasinoBonusFeed | AVOID | High | Avoid-risk | Category mismatch + brand-safety risk caps the verdict |
| 24 | @eigenlayer | [SYNTHETIC] @EngagementRaidBot | AVOID | High | Avoid-risk | Coordinated engagement ≠ technical audience demand |
| 25 | @phantom | [SYNTHETIC] @MemeGiveawayHost | AVOID | High | Avoid-risk | Giveaway-led installs = low-quality/unsafe onboarding |
| 26 | @Polymarket | [SYNTHETIC] @UnverifiedSportsTips | AVOID | High | Avoid-risk | Category overlap cannot overcome trust/regulatory risk |

(Uniswap × VitalikButerin = GOOD from the earlier verified 12-pair set remains
a valid label and is kept in pairs.json.)

## Algorithm rules distilled (user's numbering)

1. **Authority fit is its own dimension** — founder/inventor/core-team: very
   large modifier + verdict floor; official ecosystem lead: large, goal-
   conditional; adjacent founder/domain authority: moderate-large; specialist
   creator/media: no authority override; unrelated celebrity: none. Noise
   lowers confidence, not a founder pair's verdict; severe safety still wins.
2. Broad crypto reach ≠ strong fit — media gets awareness credit, limited
   high-intent match.
3. **Campaign goal can change the verdict** (goal-specific sub-scores:
   awareness/acquisition/developer/credibility/conversion/retention/community
   fit — final verdict derives from the selected goal). [FUTURE UNIT]
4. Same vertical ≠ same user intent (category_overlap vs intent_overlap).
5. Direct authority is org-specific, not universal (hayden: STRONG for
   Uniswap, OKAY for Aave).
6. **Risk signals cap verdicts by severity**: Low → warning only; Moderate →
   max GOOD/OKAY; High → max WEAK; Severe → AVOID. Cap signals: confirmed
   coordinated engagement, deceptive financial claims, phishing exposure,
   undisclosed repeated promos, casino mismatch, giveaway farming,
   impersonation, severe regulatory incompatibility. Never assigned from
   follower count or engagement rate alone.
7. Audience-quality uncertainty hits confidence first; verdict only for
   audience-only creators (founder pair + incomplete audience data = STRONG,
   Medium confidence — not WEAK).
8. Paid promotion is not automatically negative (frequency, disclosure,
   category consistency, sponsor selectivity, retention are separate).
9. Regional fit is conditional on the campaign actually targeting the region.
10. Different audience buckets matter per product category (no single global
    "crypto audience quality").
11. Independent credibility vs message controllability are different fields.
    [FUTURE — narrative-level]
12. Engagement sources have different value (thoughtful replies > quotes >
    repeat credible engagement > organic reposts > generic replies >
    giveaway replies > rings).
13. Prediction/gambling campaigns need a separate compliance/eligibility
    gate. [PARTIAL — legal_or_regulatory brand-safety flag]
14. Synthetic examples are retained as negative controls encoded as explicit
    patterns (fixtures), verifying: keyword overlap doesn't defeat risk caps;
    inflated engagement ≠ audience quality; crypto familiarity ≠ product
    intent; promo-heavy can be WEAK rather than auto-AVOID; severe confirmed
    risk stays AVOID even with category overlap.

## Suggested final scoring order (user)

Authority relationship → category/goal → content+intent overlap → engaged-
audience quality/concentration → geo/language → independence vs
controllability → preliminary fit → safety/promo/bot/regulatory caps →
verdict + confidence separately → explain which goals move the verdict.
