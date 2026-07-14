# Unit 29 (Umbrella): Analysis & Scoring Accuracy Overhaul (Scoring v2)

Status: DESIGN PROPOSAL — awaiting user review + ground-truth calibration pairs.
This umbrella spec defines the direction and the sub-units (29A–29E). Each
sub-unit gets its own detailed spec before implementation.

## Motivation (user feedback, 2026-07-13)

The user reviewed live reports and is not happy with analysis accuracy:

1. **Scores too harsh.** Good/okay KOLs land at mediocre/bad fit. Live example:
   `@Uniswap` × `@haydenzadams` (Uniswap's founder) scored **40 / WEAK** — an
   obviously wrong verdict for arguably the best possible KOL for that org.
2. **Paid promo is over-punitive.** Paid promotion is the KOL business model;
   its presence does not mean the KOL's opinions aren't taken seriously. It
   should inform, not dominate.
3. **Bot engagement is endemic** on crypto Twitter — every large KOL has bots.
   It should count less, and only *excess* bot presence should hurt.
4. **Brand safety is senseless as computed** (currently `100 − 0.7·paidPromoRisk
   − memePenalty` — i.e., mostly a rebranded promo penalty, no real safety signal).
5. **Content fit is almost always low** (exact token overlap between org
   keywords and KOL theme strings — semantically blind).
6. **Media is invisible.** X is media-first; KOLs post charts, screenshots,
   memes, videos. Text-only analysis can't be accurate.
7. **Latency matters more than cost.** "Whatever it takes" on spend, but the
   ~5–7 min live analysis is too slow; users won't wait.
8. The user will supply **ground-truth org×KOL pairs with expected outcomes**
   for calibration.

## Root-cause diagnosis of the current algorithm

- **Raw shares are used as scores.** `engaged_audience_match = 100 × (target-bucket
  share)`. Real engaged audiences are heterogeneous; even a perfect KOL rarely
  exceeds ~40–50% target share, so the core 35%-weight metric is structurally
  capped near "mediocre". (Uniswap run: ~35% relevant share → EAM ~35 → doomed.)
- **Bots are triple-punished**: they dilute EAM (denominator includes them),
  gut audience_quality (100-weight penalty), and drive bot_farm_risk + the
  verdict gate. Missing `botScore` (null) is treated as 0 in averages, so
  sparse data *lowers* measured risk while real bots crater three metrics.
- **paid_promo_risk = 15 × (count of promo-pattern strings the LLM chose to
  list)** — uncalibrated (2 vs 5 listed patterns is stylistic), and it leaks
  into brand_safety at 0.7×.
- **Target buckets** come from regex keyword scans (`KEYWORD_BUCKETS`) with an
  11-of-15-bucket generic fallback — either too narrow or absurdly broad.
- **content_fit** requires exact token equality ("lending protocol" vs "yield
  strategies" → 0).
- **geo_language_fit** is a mock-era stub (always 70/80, low confidence).
- **Engagement text is dropped** at provider normalization (who engaged, never
  what they said) — the highest-signal lever for fake-engagement detection
  (already flagged P0 in the roadmap).
- **Latency**: the pipeline fetches per-post engagement for 20 posts
  sequentially (~20 round-trip batches), and runs LLM classifications
  sequentially; audience classification runs in sequential batches.

## Architecture decision: the LLM's role in scoring (decided)

**Hybrid: rich structured labels + bounded rubric ratings from the LLM;
deterministic calibrated math produces every number.**

- The LLM labels *items* (posts, accounts, media, safety flags) and rates
  bounded rubric dimensions (0–5 integers with rationale). It never emits a
  0–100 score, weight, or verdict.
- A deterministic layer converts labels → scores via **explicit calibration
  curves** (piecewise-linear anchor tables in `packages/scoring/weights.ts`),
  tunable against the user's ground-truth pairs without touching prompts.
- Reproducibility is preserved by the Unit 23 content-addressed classification
  cache + deterministic aggregation. This keeps numbers defensible to clients
  (every score has traceable reasons) while fixing the semantic blindness.

This preserves Invariant "LLM computes no numbers" in spirit: rubric ratings
are *labels on a bounded ordinal scale*, and all arithmetic stays in
`packages/scoring`.

## Design

### A. Calibration curves — the harshness fix (scoring)

Add `curve(x, anchors)`: piecewise-linear interpolation over anchor points.
All anchor tables live in `weights.ts` as named constants. Raw shares stop
being scores. Defaults (to be tuned with ground-truth pairs):

- `EAM_ANCHORS`: (0→0, 0.05→30, 0.15→55, 0.30→75, 0.45→88, 0.60→100)
  — rationale: 30% target share of a *real engaged audience* is strong;
  45%+ is exceptional.

### B. Engaged audience match v2 (scoring + LLM)

- **Org → target buckets by LLM**: `OrgClassification` gains
  `targetBuckets: { primary: AudienceBucket[], secondary: AudienceBucket[] }`
  (additive, optional). Manual brief still overrides inference; regex
  `KEYWORD_BUCKETS` becomes the fallback when the field is absent (old cached
  classifications).
- **Human-only denominator**: EAM is computed over accounts NOT classified
  `bots_spam`/`giveaway_hunters` (their harm lives in AQ/bot-farm-risk —
  removes the triple-punishment).
- **Source weighting**: reply 1.0, quote 1.0, retweet 0.5 (retweets are the
  cheapest signal).
- **Match weighting**: primary buckets 1.0, secondary 0.5.
- `matchedShare = Σ(source_w × match_w) / Σ(source_w over human accounts)`;
  `EAM = curve(matchedShare, EAM_ANCHORS)`.

### C. Audience quality v2 — baseline-adjusted (scoring)

- `lowQ = botsShare + giveawayShare + 0.6·farmersShare` (classified sample).
- `AQ = 100 − round(AQ_SLOPE × max(0, lowQ − LOWQ_BASELINE))`;
  `LOWQ_BASELINE = 0.10` (10% junk engagement is the crypto-Twitter水位 and
  costs nothing), `AQ_SLOPE ≈ 180` (steep past the baseline), floor 0.
- Positive signal: repeat engagers (same account engaging ≥2 analyzed posts)
  add a small bonus (real community). `botScore: null` is **excluded** from
  averages (fixes null→0 deflation).

### D. Bot/farm risk v2 (scoring)

- `fakeShare = botsShare + giveawayShare + 0.5·farmersShare`.
- `risk = curve(max(0, fakeShare − LOWQ_BASELINE), BOT_RISK_ANCHORS)`.
- **Gate softened** (user: bots are inevitable): gate fires at risk ≥ 85 and
  caps the verdict at **OKAY** (not WEAK); only extreme (≥ 95, i.e. majority
  fake engagement) caps at WEAK.

### E. Paid-promo risk v2 — saturation, not presence (LLM + scoring)

- `classifyKolContent` labels **per post** (cached per-KOL, additive schema):
  `postLabels: [{ postId, isPromo, promoRelatedToKolDomain, promoQuality:
  low|ok|null }]`; provider aggregates deterministic counts.
- `promoSaturation = promoPosts / postsLabeled`;
  `unrelatedShare = unrelatedPromoPosts / max(1, promoPosts)`.
- `risk = curve(promoSaturation, PROMO_ANCHORS) × (0.5 + 0.5·unrelatedShare)`
  — a KOL promoting projects *inside their domain* at moderate frequency is
  normal business (low risk); a feed saturated with unrelated low-quality
  shills is the real risk.
- **No longer feeds brand_safety.** Gate only when risk ≥ 85 AND
  unrelatedShare > 0.5, capping at OKAY. Promo presence is otherwise
  informational (narrative + report), not score-destroying.

### F. Brand safety v2 — real signals (LLM + scoring)

- `KolContentClassification` gains `brandSafetyFlags: [{ flag, severity:
  low|medium|high, evidence }]` with flag enum: `scam_or_rug_association`,
  `misleading_claims`, `hate_or_harassment`, `nsfw_content`,
  `excessive_drama`, `gambling_promotion`, `legal_or_regulatory`,
  `impersonation_or_deception`. Evidence must quote/point at concrete posts.
- `brand_safety = 100 − Σ deductions` (high 35, medium 15, low 5; floor 0).
  No flags → 100. Meme-share penalty **removed** (memes ≠ unsafe; meme-fit is
  EAM/content-fit's job). Media analysis (H) feeds nsfw/deception flags.

### G. Content fit v2 — semantic rubric (LLM + scoring)

- New small pair-specific LLM call `assessContentFit(org, kolContent)` →
  `{ topicalAdjacency: 0–5, audienceOverlapPotential: 0–5,
  naturalMentionFit: 0–5, sharedTopics: string[], rationale: string }`.
  ("Would this KOL talking about this org feel natural to their audience?")
- Kept **out of** `classifyKolContent` so the per-KOL classification cache
  (Unit 23) stays pair-independent; this call is cheap (compact inputs) and
  cacheable per-pair.
- `content_fit = curve(0.3·adjacency + 0.4·overlap + 0.3·naturalFit, CF_ANCHORS)`
  where 3/5 ≈ 70 (adjacent domains count meaningfully). `CONTENT_FIT_CAP`
  retired (EAM dominance is already enforced by weights).
- Token-overlap becomes the deterministic fallback when the call fails.

### H. Media analysis (provider + LLM)

- `Tweet` gains optional `media: [{ type: photo|video|animated_gif, url?,
  previewUrl? }]` (additive); TwitterAPI.io normalization maps
  `extendedEntities.media` (video → thumbnail preview URL).
- `classifyKolContent` becomes **multimodal**: attach up to
  `MEDIA_IMAGE_LIMIT` (default 12) images from top posts (photos + video
  thumbnails) as image inputs. Schema gains per-attached-media labels
  aggregated to `mediaProfile: { mediaPostShare, substantiveShare, memeShare,
  promoGraphicShare }` — charts/dashboards/threads-screenshots =
  substantive; feeds content depth, promo detection, and brand-safety flags.
- Requires a vision-capable `LLM_MODEL` (the GPT-5/4o families are; current
  `gpt-5-mini` is multimodal — no new key).

### I. Engagement text + quality depth (provider + LLM + scoring)

- `EngagedAccountRaw` gains optional `text` (the reply/quote body, truncated)
  — the P0 roadmap fix at provider normalization.
- Audience classification input rows gain: reply/quote text, followingCount,
  tweetCount, createdAt, verified — dramatically better bucket + bot calls
  than bio-only. ("gm 🚀"/"wen airdrop" replies become detectable.)
- Repeat-engager detection: `collectEngagedAccounts` keeps an `appearances`
  count per unique account (dedupe already sees the duplicates; today it
  discards the count).
- Engagement-rate sanity check (deterministic, free): median engagements/post
  vs. follower count → anomaly evidence ("500k followers, 40 median
  engagements" = bought followers; near-uniform engagement across posts =
  pods). Feeds bot_farm_risk reasons + confidence, not a separate metric.

### J. Geo/language fit v2 (scoring)

- Deterministic from data already fetched: KOL post `lang` distribution
  (normalized `Tweet.lang`) + engaged-account bio language/locations.
- Org region unset/global → 85, medium confidence (was: stub 80, low).
  Region specified → match against audience/KOL language evidence via a
  small mapping table; mismatch curves down. No LLM call needed.

### K. Weights, gates, confidence (scoring)

- `OVERALL_WEIGHTS` v2 defaults: EAM .40, AQ .15, CF .15, CGF .15, BS .10,
  GLF .05 (EAM up — it's the product; AQ down — junk now handled
  baseline-adjusted).
- Verdict thresholds unchanged (80/65/50/35) — harshness is fixed upstream by
  curves, not by moving goalposts.
- Risk gates per D/E (85/OKAY-cap, extreme→WEAK) replace the blunt 70→WEAK.
- `campaign_goal_fit`: goal strings normalized (fuzzy contains → canonical
  key) so LLM-inferred "developer adoption" matches `developer_adoption`;
  target set = union(goal buckets, org targetBuckets); human-weighted shares
  like EAM; goal absent → EAM proxy (unchanged).
- Confidence keys off `engagedAccountsClassified` (recorded since Unit 17 but
  unused) + classified/sampled ratio + text/media availability.

### L. Latency (pipeline + providers) — target p50 ≤ ~2.5 min live

- Per-post engagement fetches: bounded concurrency (6–8 posts in flight) —
  ~20 sequential rounds → ~3.
- LLM: org-classify ∥ kol-content-classify; audience batches with
  concurrency 3–4; `assessContentFit` overlaps report prep.
- **Model tiering**: `LLM_MODEL_FAST` (default = `LLM_MODEL`) for audience
  batches + per-post labels; `LLM_MODEL` for narrative/report. Reasoning
  effort stays minimal for classification.
- Caps rebalance: `retweetersPerPost` 100→50 (weakest signal), replies/quotes
  unchanged (now carry text). `OPENAI_AUDIENCE_CLASSIFICATION_LIMIT` stays
  the cost knob.

### M. Calibration harness (scripts)

- `scripts/calibration/pairs.json`: user-supplied `{ orgHandle, kolHandle,
  expected: verdict-or-range, notes }`.
- Runner executes the pipeline per pair (cache-warm via Unit 23 → re-runs are
  fast + deterministic) and prints a per-metric table vs expected, flagging
  misses. Tuning loop = adjust anchor tables/weights in `weights.ts`, re-run,
  diff. No LLM re-spend after first run.

## Schema/compat constraints

- The 9 `ScoreMetric` slugs are **kept** (saved reports + UI depend on them);
  only their computation changes.
- All shared-schema changes are **additive optional** fields
  (`targetBuckets`, `postLabels`, `brandSafetyFlags`, `mediaProfile`,
  `Tweet.media`, `EngagedAccountRaw.text`) — old saved reports and cached
  classifications still validate. `REPORT_SCHEMA_VERSION` unchanged.
- Classification cache: new fields change the *output* payload shape, not the
  key inputs; bump the cache namespace (`cls:v1:` → `cls:v2:`) so stale
  pre-v2 classifications aren't served into v2 scoring.

## Sub-units (each gets its own spec before implementation)

- **29A — Provider data enrichment**: reply/quote text, `Tweet.media`,
  `appearances`, engagement-rate stats. (`packages/twitter` + `shared` +
  `collect-engagement`.)
- **29B — LLM classification v2**: targetBuckets, per-post promo labels,
  brand-safety flags, multimodal media inputs, richer audience rows,
  `assessContentFit`, model tiering, parallel batches. (`packages/llm`.)
- **29C — Scoring v2**: curves, human-only EAM, baseline-adjusted AQ/bot
  risk, saturation-based promo risk, flags-based brand safety, rubric-based
  content fit, geo v2, weights/gates/confidence. (`packages/scoring`.)
- **29D — Pipeline parallelism + latency budget**: bounded-concurrency
  fetches, parallel LLM stages, caps rebalance. (`packages/analysis`.)
- **29E — Calibration harness + tuning** against the user's ground-truth
  pairs. (`scripts/calibration`.)

Order: 29A → 29B → 29C (each verifiable alone; scoring v2 falls back
gracefully when v2 fields are absent), 29D anytime after 29A, 29E last.

## Open questions

1. **Ground-truth pairs (user, promised)**: org×KOL handles + the verdict each
   *should* get + a sentence on why. 6–12 pairs spanning strong-fit,
   promo-heavy-but-good, botted, and true-avoid cases would anchor
   calibration.
2. Latency target: is ~2–2.5 min p50 acceptable? (Sub-minute would force
   cutting sample depth.)
3. Vision/model: keep `gpt-5-mini` for everything first (it is multimodal),
   or tier narrative up to a stronger model?
4. `LOWQ_BASELINE` default 10% — adjust after calibration pairs.
