# Unit 41: Scoring v3 — "Audience-Honest"

Supersedes the scoring philosophy of Units 29C/29F/29G/30/31/32. Same product,
sharper thesis. Decided with the user in a design session (2026-07-18).

## The thesis (why v2 was wrong)

The product promise is: **"we don't check what a KOL posts — we check who
actually listens."** But v2 was tuned so that **who the creator IS** overrode
**who actually listens**: founders got a flat **+6** and a **GOOD verdict
floor**, ecosystem leads got lifts, media/adjacent creators got special caps,
and "intent" floors rescued audiences that didn't actually overlap. The tell is
in the calibration set itself — Uniswap × haydenzadams **scored 40/WEAK on pure
audience evidence**, so the founder machinery was added to *force* it to STRONG.

That is "extra scoring," and it contradicts the promise. v3 deletes it.

> **The best creator for a brand is the one whose real, engaged audience is most
> made of that brand's target customers. Measure that. For everyone. The same
> way.**

User decisions (verbatim intent):
1. **Audience only** — no identity/relationship modifiers. Same rule for all.
2. **Size counts, but shown separately** — the fit score is pure *quality of
   match*; how *many* target customers a creator reaches is a **separate
   displayed number** (expected reach), never blended in. Rationale: value =
   reach ÷ price, and only the brand knows the price — so we give the two honest
   ingredients and let the brand do the ROI math.
3. **Audience is the score** — content-fit / geo-language become *informational*,
   not score drivers. Brand-safety, bot/farm, and promo become *gates*, not
   weighted terms.
4. **Single score, done right** — stays 1:1 and absolute (not comparative); make
   the number honest + comparable so creators can be lined up (ranking later).
5. **Target = infer + confirm** — the LLM proposes the brand's target audience
   (and valued regions); the brand can correct before scoring.
6. **Goal picks who counts** — the campaign goal reshapes *which* audience
   buckets count as target; it acts *through* the audience match, not as its own
   score.
7. **Follows keep a small weight** (~0.25) in the match — not zero, not full.
8. **Bands:** 45%+ real-target share → STRONG, ~30% → GOOD, ~15% → OKAY, ~5% →
   WEAK, below → AVOID.
9. **Audience geography matters, relative to product economics** — same
   Nigerian-heavy audience is an asset for a stablecoin chain (unstable local
   currency → real stablecoin use) and a poor fit for a prediction market (low
   disposable income). A **soft tilt + a dial**, valued-regions **inferred +
   confirmed**, because X location data is thin (~⅓–½ of accounts placeable).

## The fit score (0–100, one creator, absolute)

1. Take every engaged account (reply/quote/retweet/follow).
2. **Drop the fakes entirely** — bots, giveaway-hunters, farmers count as nobody
   (they instead drive the realness dial + the fake-audience gate).
3. Weight the remainder by *how* they engaged: reply/quote **1.0**, retweet
   **0.5**, follow **0.25**.
4. **Matched share** = weighted share of that real crowd whose bucket is a brand
   **target** (target = LLM-inferred + brand-confirmed; the **goal** decides
   which buckets count; **geography** softly tilts the weight toward valued
   regions — Phase C).
5. `fit = curve(matchedShare)` on `EAM_ANCHORS` (real audiences are
   heterogeneous, so ~30% target is already strong; ~45%+ exceptional).
6. **No identity anything.** `overall_fit` **==** `engaged_audience_match`.
7. **Amended by Unit 48 (user decision, 2026-07-23):** `overall_fit =
   engaged_audience_match x activity x originality`. Both factors are
   down-only multipliers (1.0 when healthy or when data is missing):
   *activity* = curve over days since the last ORIGINAL post
   (`ACTIVITY_ANCHORS`: free through 7 days, x0.75 at 30, floor x0.35 at 90+),
   *originality* = curve over the repost share of the fetched timeline
   (`ORIGINALITY_ANCHORS`: free through 20%, x0.75 at 60%, floor x0.35 at
   100%). Rationale: a brand buys FUTURE posts in the creator's OWN voice; a
   dormant or mostly-repost feed cannot deliver the audience the match
   describes. The `engaged_audience_match` COMPONENT stays pure (it describes
   the audience); the discount lives only in `overall`. Reposts themselves are
   excluded upstream from top-post selection, content classification, post
   languages, and expected reach (their engagement counts belong to the
   original author).

### Bands (verdict thresholds on the fit score)

Chosen so the share cutoffs land right through `EAM_ANCHORS`
(0.45→88, 0.30→75, 0.15→55, 0.05→30):

| Fit score | Verdict | ≈ real-target share |
| --- | --- | --- |
| ≥ 85 | STRONG | ~45%+ |
| ≥ 70 | GOOD | ~30% |
| ≥ 50 | OKAY | ~15% |
| ≥ 30 | WEAK | ~5% |
| < 30 | AVOID | below |

### Gates (can only pull the verdict DOWN, never up)

- **Fake/farmed audience** (`bot_farm_risk`): ≥85 → OKAY, ≥95 → WEAK, ≥97 →
  AVOID. Stops "90% bots, but the 10% match" from faking a high score.
- **Brand safety**: <40 → WEAK, <20 → AVOID.
- **Paid-promo** (unrelated shilling only): risk ≥85 & unrelated-share >0.5 →
  OKAY; ≥95 → WEAK. Promo saturation alone never gates (awareness value stays).

### Deleted (the "extra scoring" purge)

- `applyAuthorityRules` (29F) — founder floor, media cap, adjacent cap.
- `AUTHORITY_OVERALL_BOOST_FOUNDER` (+6) and the authority-boost block in
  `score.ts`.
- Intent overlap damp/floor (30) — `INTENT_DAMP`, `INTENT_FLOOR`, and the EAM
  intent adjustment. (Blunter match, but honest; revisit only if too coarse.)
- Media intent tiers (30/31), adjacent-cap exempt goals, media-weak soften (32).
- The **6-way weighted overall**. `content_fit`, `campaign_goal_fit`,
  `geo_language_fit` are still *computed* and shown as components, but they no
  longer move `overall_fit`.

## The dials (shown beside the score, never blended in)

- **Expected reach** — `≈ avg(replies+quotes+retweets per post) × realness ×
  matchedShare` = *"~N of your target customers engage per post."* Data confirmed
  present (`Tweet.replyCount/quoteCount/retweetCount`).
- **Audience realness** — real vs bot/farm/giveaway share.
- **Audience geography** — country/region breakdown of the engaged audience.
- **Confidence** — scales with classified sample size + location coverage.
- **Content & geo-language** — context notes.

## Phased build

- **Phase A — core scoring purge (this unit's heart, packages/scoring only):**
  overall = EAM; delete authority + intent + media machinery; bands + gates;
  content/goal/geo demoted to informational components. No new data deps.
  Retire the obsolete regression suites (`authority-rules`, `intent-overlap`,
  `media-scoring`) and re-baseline `scoring-v2`→`scoring-v3`, `goal-conditional`,
  `negative-controls`. Retire the identity-based calibration labels in
  `scripts/calibration/pairs.json` (they encode the deleted philosophy).
- **Phase B — expected reach:** thread per-post engagement counts into
  `ScoringInput`; compute `expectedReach`; surface in the report schema.
- **Phase C — audience geography:** add `location` to `TwitterUser` +
  normalizer; carry through raw engagers → audience classification (LLM infers a
  region per account); build a region distribution; add brand **valued-regions**
  to org classification (infer + confirm); soft geo-tilt in the match + a geo
  dial. Fold **goal → target buckets** here too (both reshape the match).
- **Phase D — surface it:** report schema + `FitReportView` + PDF + the LLM
  narrative prompt to present the new verdict + dials; drop v2 metric explainers.

## Invariants preserved

Scoring stays deterministic and in `packages/scoring` (Invariant 4); numbers are
computed here, never by the LLM; output validated against `ScoreBreakdownSchema`;
missing data lowers confidence, never breaks (Invariant 8).

## Robustness (live-verification fixes)

- **Empty-org-profile guard:** a null `getUserProfile` for the brand (e.g. a
  renamed/dead handle) with no manual brief throws, mirroring the empty-KOL-posts
  guard — never a confident verdict from nothing.
- **Unknown-target cap:** when targets fall back to the generic "any real crypto"
  set, the fit is capped at `GENERIC_TARGET_MAX_FIT` (STRONG−1 → max GOOD) and
  forced to low confidence with an "add your target" caveat.

## Cleanup (obsolete pre-v3 scaffolding removed)

v3 deletes not just the identity *scoring* but the artifacts built around it:

- **Calibration harness** (`scripts/calibration/*`, the `krypto-kol-calibration-*`
  docs, `pnpm calibrate`, and the `--selftest` in `pnpm check`) — it encoded
  hand-labeled *identity-based* expected verdicts. Correctness is now the
  `scoring-v3` unit tests, not hand-labeled live pairs.
- **Vestigial LLM fields** the model emitted but v3 never consumed: the Unit 29F
  `relationship`/`relationshipEvidence` (+ `KolRelationship`) and the Unit 30
  `audienceIntentOverlap` — removed from the shared schema, the OpenAI
  schema+prompt, and the mock. `assessContentFit` now returns only the
  content-fit rubric.
