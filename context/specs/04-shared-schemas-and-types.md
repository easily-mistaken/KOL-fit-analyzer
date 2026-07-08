# Unit 04: Shared Schemas and Types

## Goal

Give `packages/shared` the canonical Zod schemas, inferred TypeScript types, enums, and constants that the rest of the system validates and speaks in. This is the **contract layer**: API routes (Unit 05+), the worker (Unit 07+), provider packages (Units 10–11, 16–17), the analysis pipeline (Unit 13), the scoring module (Unit 14), and the report renderer (Unit 15) will all import from `@kol-fit/shared` instead of redefining shapes locally.

At the end of this unit, `@kol-fit/shared` exports:

- the analysis **request input** schema (mirrors the `AnalysisRequest` columns),
- the **report output** schema (the 15-section fit report the LLM must produce and the UI renders),
- the **score** schema (the 9 deterministic metrics + confidence),
- the **audience bucket** enum + distribution schema,
- **job/report status** + **verdict** + **engagement source** enums whose string values match the Prisma enums from Unit 03,
- **provider-neutral Twitter/X** normalized data types,
- **provider-neutral LLM** structured-output types,
- **analysis cap** constants,
- **API response / error** shapes and helpers.

Nothing consumes these yet — this unit only defines and exports them, and proves they compile and validate.

Explicit non-goals for this unit (do not implement here):

- No API routes (Unit 05+). This unit defines the response *shapes*, it does not create handlers.
- No queue/pg-boss or worker logic (Units 06–07).
- No TwitterAPI.io client or any live provider call (Unit 16) — only the neutral *types* a provider must normalize to.
- No OpenAI/LLM provider logic (Unit 17) — only the neutral structured-output *types*.
- No scoring implementation or weights logic (Unit 14) — only the score *schema* (metric keys + value shape). Numeric weights stay in `packages/scoring`.
- No database schema changes. `packages/db` is not touched unless a build genuinely breaks (it should not).
- No commits.

## Alignment and Boundary Decisions

These are the non-obvious design calls; they are settled here so implementation is unambiguous.

1. **`packages/shared` stays a dependency-free leaf.** It must not import from `@kol-fit/db` (that would invert the dependency direction — db and everything else depend on shared, not the reverse). The status/verdict/source enums are therefore **mirrored** in shared as Zod enums whose string values are byte-for-byte identical to the Prisma enums (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `PENDING`, `STRONG`, …, `REPLY`, `QUOTE`, `RETWEET`, `FOLLOWER`). The Prisma schema (Unit 03) remains the DB source of truth; shared mirrors it for validation/UI. Each mirrored enum carries a comment pointing at `packages/db/prisma/schema.prisma`, and a drift check is added to verification (compare the value lists). An optional compile-time equality test can live later in a package that already imports both — not in shared.

2. **Canonical string values / casing.**
   - Status / verdict / engagement-source enums use the **UPPERCASE** Prisma values so a value serializes identically across DB ↔ API ↔ UI.
   - Audience buckets and other shared-only vocabularies (campaign goal, product stage) use **lowercase snake_case** machine values with separate human display labels (these are stored as JSON / free text, not Prisma enums, so shared owns them).

3. **Weights are not here.** `packages/shared` owns the score *schema* (the metric key enum + the per-metric value shape). The numeric weights table lives in `packages/scoring` (Unit 14), per `code-standards.md` (scoring weights centralized in the scoring package). Shared must not duplicate the weights.

4. **Request context fields are permissive strings.** `campaignGoal` and `stage` are optional free strings on the request input (matching the nullable `AnalysisRequest` columns and the free-form Unit 08 form). Shared *also* exports `CampaignGoalSchema` / `ProductStageSchema` enums of the known values for later structured use, but the request schema does not force them, so the form never rejects a reasonable entry.

5. **Report schema is versioned.** The report output schema carries a `schemaVersion` field and shared exports a `REPORT_SCHEMA_VERSION` constant (starts at `1`), matching `Report.reportSchemaVersion` in the DB and `code-standards.md` ("store report schema version with each report").

## Schema / Type Design

Proposed module layout under `packages/shared/src/` (small, single-purpose files per `code-standards.md`; all named exports; `index.ts` re-exports everything):

```
packages/shared/src/
  index.ts        # barrel — re-exports all modules
  constants.ts    # APP_NAME, product positioning line, REPORT_SCHEMA_VERSION
  caps.ts         # ANALYSIS_CAPS
  enums.ts        # JobStatus, ReportStatus, ReportVerdict, EngagementSource (Prisma-aligned)
  vocab.ts        # AudienceBucket, CampaignGoal, ProductStage (+ display labels)
  handle.ts       # Twitter/X handle normalization + schema
  request.ts      # AnalysisRequestInput schema
  scores.ts       # ScoreMetric, ScoreValue, ScoreBreakdown schemas
  audience.ts     # audience distribution + account classification schemas
  twitter.ts      # provider-neutral Twitter/X normalized types
  llm.ts          # provider-neutral LLM structured-output types
  report.ts       # FitReport (15-section) output schema
  api.ts          # ApiResponse<T>, ApiErrorCode, ok()/err() helpers
```

Every schema uses Zod; every consumer-facing type is `z.infer<typeof XSchema>` exported alongside the schema (schema + type share a name pattern: `FooSchema` / `Foo`).

### constants.ts

- `APP_NAME` (keep the existing value; move here from the current `index.ts`).
- `PRODUCT_POSITIONING = "We don't just check what a KOL posts. We check who actually listens."` (exported for reuse; wiring the landing page to it is out of scope for this unit).
- `REPORT_SCHEMA_VERSION = 1`.

### caps.ts — analysis depth/cost caps (from `architecture.md`)

```ts
export const ANALYSIS_CAPS = {
  kolPostsFetched: 100,
  kolRepliesFetched: 50,
  topPostsForDeepAnalysis: 20,
  repliesPerPost: 50,
  quotesPerPost: 30,
  retweetersPerPost: 100,
  maxUniqueEngagedAccounts: 1500,
} as const;
```

These are plain constants now; environment-variable overrides are deferred to Unit 19. Values must match the `architecture.md` → *Analysis Depth and Cost Controls* table exactly.

### enums.ts — Prisma-aligned Zod enums

```ts
// Values MUST match packages/db/prisma/schema.prisma enums (DB is source of truth).
export const JobStatusSchema = z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED"]);
export const ReportStatusSchema = z.enum(["PENDING", "COMPLETED", "FAILED"]);
export const ReportVerdictSchema = z.enum(["STRONG", "GOOD", "OKAY", "WEAK", "AVOID"]);
export const EngagementSourceSchema = z.enum(["REPLY", "QUOTE", "RETWEET", "FOLLOWER"]);
// + inferred types JobStatus, ReportStatus, ReportVerdict, EngagementSource
```

### vocab.ts — shared-only vocabularies

- `AudienceBucketSchema` — the 15 buckets from `project-overview.md`, lowercase snake_case machine values with display labels:
  `founders`, `developers`, `defi_users`, `traders`, `investors_vcs`, `airdrop_farmers`, `meme_degens`, `nft_gaming`, `ai_crypto`, `infra_research`, `community_managers`, `kols_creators`, `bots_spam`, `giveaway_hunters`, `non_crypto`.
  Export `AUDIENCE_BUCKET_LABELS: Record<AudienceBucket, string>` for the UI.
- `CampaignGoalSchema` — known goals from `project-overview.md`: `awareness`, `community_growth`, `user_acquisition`, `developer_adoption`, `token_launch_visibility`, `investor_credibility`.
- `ProductStageSchema` — e.g. `pre_launch`, `testnet`, `mainnet`, `token_live`, `growth` (canonical lowercase set; display labels alongside).

### handle.ts — Twitter/X handle handling

- `normalizeHandle(input: string): string` — trims, strips a leading `@`, lowercases, and returns the bare handle.
- `HandleSchema` — `z.string()` transformed via `normalizeHandle`, then validated against Twitter's rule (`^[A-Za-z0-9_]{1,15}$`) with a clear error message. Reused by the request schema.

### request.ts — analysis request input (mirrors `AnalysisRequest`)

```ts
export const AnalysisRequestInputSchema = z.object({
  orgHandle: HandleSchema,
  kolHandle: HandleSchema,
  websiteUrl: z.string().url().optional(),
  docsUrl: z.string().url().optional(),
  productCategory: z.string().trim().min(1).max(120).optional(),
  targetUser: z.string().trim().min(1).max(280).optional(),
  campaignGoal: z.string().trim().min(1).max(120).optional(), // free string; see CampaignGoalSchema
  stage: z.string().trim().min(1).max(120).optional(),
  region: z.string().trim().min(1).max(120).optional(),
});
// type AnalysisRequestInput = z.infer<...>
```

Fields correspond 1:1 to the nullable `AnalysisRequest` columns. `workspaceId` is **not** part of the user input (auth out of scope; it is set server-side later).

### scores.ts — deterministic score schema (no weights)

- `ScoreMetricSchema` — the 9 metrics: `overall_fit`, `content_fit`, `engaged_audience_match`, `audience_quality`, `campaign_goal_fit`, `geo_language_fit`, `brand_safety`, `paid_promo_risk`, `bot_farm_risk`.
- `ConfidenceLevelSchema` — `z.enum(["low", "medium", "high"])`.
- `ScoreValueSchema` — `{ value: z.number().int().min(0).max(100), confidence: ConfidenceLevelSchema, reasons: z.array(z.string()).default([]) }` (evidence signals per `code-standards.md` scoring output).
- `ScoreBreakdownSchema` — `{ overall: ScoreValueSchema, components: z.record(ScoreMetricSchema, ScoreValueSchema), confidence: ConfidenceLevelSchema }`. Matches the `Report.scores` JSON column. Risk metrics (`paid_promo_risk`, `bot_farm_risk`) documented as "higher = more risk".

### audience.ts — audience distribution + account classification

- `AudienceAccountSchema` — a classified engaged account: `{ handle?, accountId?, source: EngagementSourceSchema, bucket: AudienceBucketSchema, signals: z.object({ botScore: z.number().min(0).max(1).optional(), emptyBio: z.boolean().optional(), farmingSignals: z.array(z.string()).default([]) }).partial() }`. Aligns with `EngagedAccountSample`.
- `AudienceDistributionSchema` — per-bucket counts + share: `z.record(AudienceBucketSchema, z.object({ count: z.number().int().min(0), share: z.number().min(0).max(1) }))`, plus `sampleSize: z.number().int().min(0)`. Matches `Report.audienceSummary`.

### twitter.ts — provider-neutral Twitter/X normalized types

Normalization targets that any Twitter provider (mock in Unit 10, TwitterAPI.io in Unit 16) must produce; provider responses are validated against these before entering the pipeline (Invariant 9). No provider-specific fields.

- `TwitterUserSchema` — `{ id, handle, displayName?, bio?, followersCount?, followingCount?, tweetCount?, verified?, createdAt?, avatarUrl? }`.
- `TweetSchema` — `{ id, authorId?, authorHandle?, text, createdAt?, likeCount?, retweetCount?, replyCount?, quoteCount?, viewCount?, isReply?, isQuote?, lang? }`.
- `EngagedAccountRawSchema` — a raw engager tied to a tweet + `source: EngagementSourceSchema` (pre-classification counterpart of `AudienceAccountSchema`).

These are intentionally lean (metadata summaries, not raw payloads — Invariant 15). Counts are optional because not every provider returns every field; missing optional data lowers confidence rather than breaking (Invariant 8).

### llm.ts — provider-neutral LLM structured-output types

The structured outputs an LLM provider must return and that must pass Zod validation before use/persistence (Invariants 3, 9, 12; `code-standards.md` LLM Usage). Reuse the schemas above rather than re-deriving.

- `OrgClassificationSchema` — inferred org fields with confidence: `{ productCategory?, targetUser?, stage?, campaignGoal?, region?, keywords: string[], confidence: ConfidenceLevelSchema }` (manual brief overrides these — Invariant 7).
- `KolContentClassificationSchema` — `{ themes: string[], verticals: string[], style?, depth?, promoPatterns: string[], repeatedTickers: string[] }`.
- `AudienceClassificationSchema` — `{ accounts: AudienceAccountSchema[], distribution: AudienceDistributionSchema }`.
- `FitReportSchema` — re-exported from `report.ts` (the LLM's final structured output *is* the fit report).

Light input types (TS interfaces for the compact evidence handed to each capability) may be included where they clarify the contract, but the emphasis is the validated **output** schemas.

### report.ts — the 15-section fit report output schema

`FitReportSchema` — the structured report validated before saving (`Report.report` JSON) and rendered by Unit 15. Carries `schemaVersion: z.literal(REPORT_SCHEMA_VERSION)` and covers all 15 sections from `project-overview.md`:

1. `overallScore` (ScoreValue) · 2. `verdict` (ReportVerdict) · 3. `bestUseCases: string[]` · 4. `weakUseCases: string[]` · 5. `audienceMatch` (summary text + score) · 6. `audienceBreakdown` (AudienceDistribution) · 7. `contentAnalysis` (KolContentClassification + narrative) · 8. `engagementQuality` (narrative + signals) · 9. `paidPromo` (detection narrative + risk score) · 10. `botFarmRisk` (narrative + risk score) · 11. `brandSafety` (narrative + score) · 12. `geoLanguageFit` (narrative + score) · 13. `recommendedAngle: string` · 14. `evidence` (`{ sampleSizes: ..., notes: string[] }`, matching `ReportEvidence`) · 15. `confidence` (ConfidenceLevelSchema).

Optional sections degrade gracefully (Unit 15 requirement): use `.optional()` on narrative sections so a missing section does not fail validation, while required spine fields (overall score, verdict, confidence, evidence) stay mandatory.

### api.ts — response and error shapes

Matches `code-standards.md` → *API Routes*:

```ts
export const ApiErrorCodeSchema = z.enum([
  "validation_error", "not_found", "conflict", "rate_limited",
  "provider_error", "internal_error",
]);

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string } };

export const ok = <T>(data: T): ApiResponse<T> => ({ ok: true, data });
export const err = (code: ApiErrorCode, message: string): ApiResponse<never> =>
  ({ ok: false, error: { code, message } });
```

Provider-specific raw errors are never surfaced (they map to `provider_error`); no stack traces in responses.

## Implementation Steps

1. **Add Zod** to `packages/shared`: `pnpm --filter @kol-fit/shared add zod`. Adapt to whatever `latest` resolves to (expected Zod 4.x) exactly as prior units adapted to their toolchains; if a v4 API differs from a sketch above (e.g. `z.record` arity, `z.enum` on readonly arrays), follow the resolved version's API.
2. **Create the module files** under `packages/shared/src/` per the layout above, moving `APP_NAME` from the current `src/index.ts` into `constants.ts`.
3. **Barrel exports:** rewrite `packages/shared/src/index.ts` to `export * from "./<module>.js"` for every module (Node16 requires the `.js` specifier, matching the pattern used in `packages/db`). Keep `APP_NAME` importable from `@kol-fit/shared` (web + worker already import it — do not break them).
4. **Keep each file small and single-purpose;** split further if a file grows beyond one concern (`code-standards.md`). Named exports only.
5. **Do not touch** `packages/db` (schema or generated client), `packages/{twitter,llm,analysis,scoring}` source, `apps/web`, `apps/worker`, and create no API routes.

## Dependencies

- `zod` (runtime dependency, in `packages/shared`).

Explicitly **not** introduced: `pg-boss`, provider SDKs (OpenAI/TwitterAPI.io), any DB/web/worker dependency. `packages/shared` gains **no** dependency on `@kol-fit/db`.

## Verification Checklist

- [ ] `zod` is a dependency of `packages/shared`; no other new dependency added.
- [ ] `pnpm build` passes across all 8 packages/apps (shared compiles; `APP_NAME` still resolves for web + worker).
- [ ] `@kol-fit/shared` re-exports every module from `index.ts`; a scratch import (`import { AnalysisRequestInputSchema, FitReportSchema, ScoreBreakdownSchema, AudienceBucketSchema, JobStatusSchema, ANALYSIS_CAPS, ok, err } from "@kol-fit/shared"`) type-checks.
- [ ] **Enum drift check:** the string values in `JobStatusSchema`, `ReportStatusSchema`, `ReportVerdictSchema`, `EngagementSourceSchema` match the corresponding enums in `packages/db/prisma/schema.prisma` exactly (compare value lists).
- [ ] **Caps check:** `ANALYSIS_CAPS` values equal the `architecture.md` → *Analysis Depth and Cost Controls* table (100 / 50 / 20 / 50 / 30 / 100 / 1500).
- [ ] Request schema fields correspond 1:1 to the nullable `AnalysisRequest` columns (`orgHandle`, `kolHandle`, `websiteUrl`, `docsUrl`, `productCategory`, `targetUser`, `campaignGoal`, `stage`, `region`); `workspaceId` is not a user-input field.
- [ ] A quick offline parse smoke test (scratch `tsx`/node script, not committed): a valid `AnalysisRequestInput` fixture parses; an invalid one (e.g. bad handle, non-URL `websiteUrl`) is rejected; a valid `FitReport` fixture parses. (No test runner is added this unit.)
- [ ] Score schema exposes the 9 metrics and a 0–100 integer value with confidence; **no numeric weights** live in `packages/shared`.
- [ ] The 15 audience buckets and the 15 report sections are all present.
- [ ] No API routes created; no `packages/db` changes; no provider/LLM/scoring/queue/worker/UI logic added.
- [ ] `context/progress-tracker.md` updated to reflect Unit 04 status once implemented.
- [ ] No commits made.
```
