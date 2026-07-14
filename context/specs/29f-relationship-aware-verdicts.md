# Unit 29F: Relationship-Aware Verdicts (authority fit)

Part of the Unit 29 accuracy overhaul. Motivated by the user's verified
12-pair calibration set (`context/krypto_kol_calibration_pairs_verified_12.md`),
whose central lessons the current algorithm cannot express:

- **Founder/core-team pairs must not collapse** on noisy public engagement
  (Uniswap×hayden, Chainlink×Sergey, Jupiter×meow, EigenLayer×sreeram → STRONG).
- **Adjacent ecosystem authority ≠ direct authority** (Uniswap×Vitalik,
  Phantom×Anatoly → GOOD, not auto-STRONG on fame + topical fit).
- **Media reach ≠ product fit** (Uniswap×WatcherGuru → WEAK|OKAY;
  MetaMask×Bankless → GOOD|OKAY only with audience proof).
- Independent specialists (Ledger×ZachXBT, Ethena×TheDeFinvestor) can be GOOD
  without core-team status.

Per the doc's rules section: authority is a **separate modifier** (verdict
floor/cap logic), NOT another diluted weighted metric. The 9 ScoreMetric
slugs stay unchanged.

## 1. Relationship classification (LLM label, packages/llm + shared)

`ContentFitAssessmentSchema` (additive optional) gains:

- `relationship`: `founder_or_core_team | adjacent_ecosystem_authority |
  independent_specialist | media_or_news | none`
- `relationshipEvidence: string` — what grounds the call (bio claim, public
  role).

`AssessContentFitInput.kol` gains `profile?: TwitterUser | null` — the KOL
bio is the primary evidence ("inventor of Uniswap Protocol", "Solana
co-founder", "crypto news"), backed by the model's public knowledge. The
pair-specific `assessContentFit` call is the natural home (already
pair-addressed + cached; the fit cache key gains the profile identity).
Strict schema + prompt define the categories precisely:

- founder_or_core_team: founder/inventor/CEO/core team OF THIS ORG
  specifically.
- adjacent_ecosystem_authority: founder/major figure of the underlying
  chain/ecosystem, NOT this org.
- independent_specialist: respected independent analyst/investigator/
  researcher in the org's domain.
- media_or_news: a media/news/aggregator account.
- none: ordinary KOL.

Mock: deterministic rules (bio mentions org handle/name + founder terms →
founder; founder terms without org mention → adjacent; news/media terms →
media; analyst/investigator terms → specialist; else none).

## 2. Authority modifier (packages/scoring)

Constants in `weights.ts`:

- `AUTHORITY_FLOOR_FOUNDER = "GOOD"` — verdict floor for founder/core-team
  pairs, applied ONLY when brand_safety ≥ `AUTHORITY_MIN_BRAND_SAFETY` (60)
  AND no risk gate fired (severe risk always wins, per the doc).
- `MEDIA_CAP = "OKAY"` + `MEDIA_CAP_EAM_EXEMPT = 75` — media/news accounts
  cap at OKAY unless the engaged-audience match itself proves quality
  (EAM ≥ 75) — "require engaged-audience proof before high conversion fit".
- Adjacent authority + independent specialist: no floor/cap (they must earn
  the verdict through the metrics); surfaced in reasons.

`verdict.ts` gains `applyAuthorityRules(verdict, ctx)` applied AFTER the
risk gates in `scoreAnalysis`; overall reasons state the relationship and
any floor/cap applied. Floors never override risk caps; caps combine as min.

## 3. Pipeline

`run-analysis.ts` passes `kolProfile` into `assessContentFit`. No other
changes.

## Out of scope

Campaign-goal-driven verdict *ranges* (the runner's `A|B` grammar covers
the base×jesse ambiguity for now); per-bucket product-category target
tuning beyond what org.targetBuckets already gives (29E tuning decides with
live data); UI changes.

## Verification

`pnpm build`; new `scripts/checks/authority-rules.regression.cjs` in
`pnpm check`: schema additive; OpenAI relationship round-trip + prompt
includes bio + categories; fit cache key sensitive to profile; mock
relationship rules deterministic (founder vs adjacent vs media vs none);
floor applies (founder + WEAK base → GOOD) and yields to risk gates + low
brand safety; media cap applies and is exempted by high EAM; adjacency has
no floor. Mock pipeline E2E stays valid/deterministic.
