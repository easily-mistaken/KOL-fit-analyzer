# Unit 29B: LLM Classification v2 (labels the scoring overhaul needs)

Part of the Unit 29 accuracy overhaul (`29-analysis-accuracy-overhaul.md`).
Goal: upgrade the LLM's structured outputs and inputs so 29C's deterministic
scoring has calibrated evidence. The LLM still never emits scores/weights/
verdicts — only labels and bounded 0–5 rubric ratings. Pipeline + scoring are
NOT touched (29C wires consumption).

## Scope

### 1. Shared schemas (additive optional)

`packages/shared/src/llm.ts`:

- `OrgClassification.targetBuckets?: { primary: AudienceBucket[], secondary:
  AudienceBucket[] }` — the org's wanted audience, inferred by the LLM
  (replaces regex keyword derivation as the primary source in 29C).
- `KolContentClassification` gains:
  - `postLabels?: [{ postId, isPromo: boolean, promoRelated?: boolean,
    promoQuality?: "low"|"ok" }]` — per-post promo labels → 29C computes promo
    *saturation* deterministically.
  - `brandSafetyFlags?: [{ flag: <enum of 8>, severity: low|medium|high,
    evidence: string }]` — flags: scam_or_rug_association, misleading_claims,
    hate_or_harassment, nsfw_content, excessive_drama, gambling_promotion,
    legal_or_regulatory, impersonation_or_deception.
  - `mediaLabels?: [{ postId, kind: chart_or_data|screenshot_text|meme|
    promo_graphic|photo_other }]` — one label per attached image; shares are
    aggregated deterministically later, never by the model.
- New `ContentFitAssessmentSchema`: `{ topicalAdjacency: 0–5 int,
  audienceOverlapPotential: 0–5 int, naturalMentionFit: 0–5 int,
  sharedTopics: string[], rationale: string }`.

### 2. Provider interface

`LlmProvider` gains a fifth method `assessContentFit({ org: { handle,
classification }, kol: { handle, content } }) → ContentFitAssessment` — the
pair-specific semantic content-fit rubric. Kept OUT of `classifyKolContent`
so the per-KOL classification cache stays pair-independent.

### 3. OpenAI provider

- **Strict schemas** extended per §1 (all-required/nullable per strict-mode
  rules); new `CONTENT_FIT_SCHEMA` (integer 0–5 enforced by shared Zod).
- **Prompts**: org prompt asks for primary/secondary target buckets from the
  bucket enum; KOL content prompt lists posts WITH ids (`[postId] text`),
  asks for per-post labels + safety flags (evidence must reference posts) and
  labels each *attached image* by postId; audience prompt rows now include
  the engagement `text` (from 29A) + followingCount/tweetCount/createdAt/
  verified; new content-fit rubric prompt defines the three 0–5 dimensions.
- **Multimodal**: `classifyKolContent` attaches up to `OPENAI_MEDIA_IMAGE_LIMIT`
  (default 12) http(s) image URLs from the posts' 29A media (photo `url`,
  video/gif `previewUrl`) as `input_image` parts. Client `respond()` gains an
  optional `images` param (user content becomes input_text + input_image
  parts). Requires a vision-capable `LLM_MODEL` (gpt-5-mini is).
- **Model tiering**: optional `LLM_MODEL_FAST` env (factory) / `fastModel`
  option → a second client used for the bulk per-account audience batches;
  everything else stays on `LLM_MODEL`. Usage stats merged across both.
- **Parallel audience batches**: bounded concurrency 3 (was sequential);
  results stay input-ordered.

### 4. Mock provider

Deterministic equivalents: targetBuckets via keyword rules over org category/
keywords; per-post promo labels via giveaway/ticker scan; safety flags via
scam/rug keyword scan (normally empty); media labels from fixture URL hints;
`assessContentFit` from token overlap mapped to 0–5 ratings. All validated
against the shared schemas.

### 5. Classification cache

- Namespace `cls:v1` → `cls:v2` (prompts/inputs/outputs changed).
- Audience key now includes each account's engagement `text` (it affects
  classification).
- `assessContentFit` cached under a new `fit` kind, content-addressed by
  org-classification + kol-content + model (reuses `contentSeconds` TTL —
  no config change).

### 6. Env

`.env.example` += optional `LLM_MODEL_FAST`, `OPENAI_MEDIA_IMAGE_LIMIT`.

## Out of scope

Pipeline wiring of `assessContentFit` + consumption of the new labels
(29C scoring v2), pipeline parallelism (29D), caps changes (29D).

## Verification

`pnpm build`; new `scripts/checks/classification-v2.regression.cjs` in
`pnpm check` (injected fetch, offline): schemas additive (old payloads
validate); org targetBuckets round-trip; content postLabels/flags/mediaLabels
round-trip; image parts attached + capped; audience prompt carries text +
stats; audience batches run concurrently on the fast model when configured,
input-ordered; content-fit rubric validated (out-of-range rejected);
mock determinism for all new fields; cache: cls:v2 keys, fit cached,
audience key text-sensitive. Plus mock pipeline E2E still green.
