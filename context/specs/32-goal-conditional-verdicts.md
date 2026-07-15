# Unit 32: Goal-Conditional Verdicts (v1) + Official Ecosystem Lead

v26 rule 3: campaign goal can change the verdict — the same pair can be
STRONG for builders and GOOD for retail awareness. And the v26 authority
hierarchy names a class the 29F enum lacks: **"Official ecosystem lead/
community: large modifier, conditional on campaign goal."** Its absence is
why base×jessepollak (creator of Base) flickers between adjacent/specialist,
and why no adjacent-authority cap could fix Uniswap×Vitalik (STRONG 85 vs
GOOD, the last structural calibration miss) without breaking jesse.

## Design

1. **New relationship class `official_ecosystem_lead`** (additive enum
   value): publicly-known creator/lead/official operator of the org's
   platform or ecosystem program, even when the bio understates it — sits
   between founder and adjacent. Prompt defines it identity-first.
2. **Authority rules become goal-aware** (`applyAuthorityRules` ctx gains
   `goalKey` — the normalized campaign goal, absent = "normal
   product-relevant campaign"):
   - `official_ecosystem_lead`: founder-grade floor (GOOD) always (subject
     to the same gates/brand-safety conditions); founder-grade overall boost
     (+6) EXCEPT under a pure retail `awareness` goal (v26 pair-3 note:
     "STRONG for builder campaigns, GOOD for broad retail awareness").
   - `adjacent_ecosystem_authority`: **capped at GOOD** unless the goal is
     `awareness` or `investor_credibility` (adjacent fame shines for
     credibility/awareness; a default product campaign requires direct
     authority or audience evidence for STRONG). Fixes Vitalik under the
     default assumption without touching jesse (who moves to official lead).
   - Media cap WEAK tier softens to OKAY under an `awareness` goal ("OKAY
     for a broad awareness burst" — WatcherGuru's own label note).
3. Goal keys come from the existing `normalizeGoal` (brief.campaignGoal
   first, org-inferred goal second — Invariant 7 order preserved).

## Predicted calibration effect (default goal, LLM_MODEL_FIT=gpt-5)

Uniswap×Vitalik → GOOD (adjacent cap) = **15/17 exact-band**. jesse →
official_ecosystem_lead → floor+boost (85→91, stays STRONG). meow STRONG 88
(fit tier). Remaining misses: Aave×hayden (65, boundary jitter) and
fhenix×ETHIndia (intent 3↔4 flicker, Medium-confidence label).

## Scope

shared `KolRelationshipSchema` += value; OpenAI schema/prompt; mock rule;
weights (`ADJACENT_CAP`, exempt goals, awareness softening); verdict/score
wiring; fit-cache purge (prompt changed); regression check
`goal-conditional.regression.cjs`; live validation. Out of scope:
goal-specific sub-scores (awareness_fit/developer_fit etc. — a later,
larger unit), UI goal-switcher.

## Live validation results (2026-07-15, LLM_MODEL_FIT=gpt-5)

**16/17 valid pairs exact-band** (from 13/17 after Unit 30; 9/17 after 29;
~5 under v1-equivalent scoring). Two definition iterations were needed after
the gpt-5 judge exposed prompt gaps (each fix anchored in the v26 doc, not
invented): media_or_news redefined as BRAND accounts incl. community/event
brands (ETHIndia → media cap restored); official_ecosystem_lead includes
publicly announced advisors of the org (Nate's documented Polymarket role →
authority floor); specialization contrast in the intent rubric (generalist
builders ≠ FHE specialists → fhenix×ETHIndia intent 3 → OKAY tier).

Final table: all 5 founder/lead pairs STRONG (jesse 91 as
official_ecosystem_lead, meow 88 as pseudonymous founder via the gpt-5 fit
tier); Vitalik GOOD-capped in run 7 / OKAY 64 in run 8 — the ONE remaining
miss, an intent 2↔3 judgment flicker where the opposite-labeled Aave×hayden
pair (OKAY 63 ✓) sits on the same rating, so no constant can separate them;
ETHIndia trio GOOD/GOOD/OKAY; Nate GOOD 72; media WEAK trio all WEAK; three
TwitterAPI.io data-gap handles error loudly (upstream).

**Operational requirement:** production must set `LLM_MODEL_FIT=gpt-5` in
`.env` — calibration used it inline; without it the worker's fit judgments
run on gpt-5-mini and the relationship/intent quality documented here does
not apply.
