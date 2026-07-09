# Unit 11: LLM Provider Interface and Mock Provider

## Goal

Give `packages/llm` its provider abstraction: an `LlmProvider` interface (the four capabilities from `architecture.md`) whose outputs are the provider-neutral shared LLM schemas, plus a **deterministic mock implementation** and a model-agnostic factory so later units select a provider by config. No OpenAI, no network — the mock returns stable, valid structured outputs rich enough to drive the Unit 13 pipeline.

Mirrors the Unit 10 Twitter provider pattern (interface + deterministic mock + `create*Provider` factory + env selection + "live provider throws until its unit").

Explicit non-goals for this unit (later units own these):

- **No OpenAI integration / no network calls** (Unit 17). Only the interface + mock.
- **No numeric scoring.** The LLM never computes final numeric scores — those are deterministic and belong to `packages/scoring` (Unit 14). See *Structured Input/Output Design*.
- No worker/pipeline changes (Unit 13), no API route, UI, or Prisma schema changes.
- No TwitterAPI.io logic (that's `packages/twitter`, Unit 10/16).
- No commits.

## LLM Provider Interface Design

All LLM calls go through this interface (Invariant 3); implementations return the shared schemas, validated before use (Invariants 9, 12). Method set matches `architecture.md` → *LLM Provider Interface* (four capabilities — no more, no fewer).

```ts
import type {
  OrgClassification,
  KolContentClassification,
  AudienceClassification,
  FitReport,
} from "@kol-fit/shared";

export interface LlmProvider {
  /** The configured model id (from LLM_MODEL). Recorded with reports; never hardcoded. */
  readonly model: string;

  classifyOrgProfile(input: ClassifyOrgInput): Promise<OrgClassification>;
  classifyKolContent(input: ClassifyKolContentInput): Promise<KolContentClassification>;
  classifyAudienceAccounts(input: ClassifyAudienceInput): Promise<AudienceClassification>;
  generateFitReport(input: GenerateFitReportInput): Promise<FitReport>;
}

export type LlmProviderKind = "mock" | "openai";
```

- **Model-agnostic:** the provider carries a `model` string (sourced from `LLM_MODEL` via the factory), exposed so the pipeline can store it on `Report.llmModel`. No real model name is hardcoded anywhere; the concrete value is chosen in Unit 17.
- The **five outputs** in the Unit 11 scope map onto these four methods (no separate risk method — that would diverge from the architecture interface):

  | Scope output | Delivered by |
  | --- | --- |
  | org / product classification | `classifyOrgProfile` → `OrgClassification` |
  | KOL content classification | `classifyKolContent` → `KolContentClassification` |
  | engaged audience / account classification | `classifyAudienceAccounts` → `AudienceClassification` |
  | paid-promo / brand-risk interpretation | `classifyKolContent.promoPatterns` (signals) + the `paidPromo` / `botFarmRisk` / `brandSafety` **narrative** fields of `generateFitReport` |
  | final report narrative / synthesis | `generateFitReport` → `FitReport` |

## Structured Input/Output Design

**Outputs** reuse the shared schemas verbatim (no new shared types this unit): `OrgClassificationSchema`, `KolContentClassificationSchema`, `AudienceClassificationSchema`, and `FitReportSchema`. The mock **validates every output** against its schema before returning (Invariant 12) — the same contract the live provider must meet.

**Inputs** are LLM-call request shapes (compact, structured evidence — not raw payloads, per `code-standards.md` LLM Usage). They are provider-neutral and live in `packages/llm` (composed from shared types); Unit 13 may refine them when it wires the pipeline. Minimal shapes:

```ts
import type {
  Tweet, TwitterUser, EngagedAccountRaw,
  OrgClassification, KolContentClassification, AudienceClassification,
  ScoreBreakdown, ReportVerdict,
} from "@kol-fit/shared";

export type ClassifyOrgInput = {
  handle: string;
  profile: TwitterUser | null;
  recentPosts?: Tweet[];
  // Manual brief from the analysis request; these OVERRIDE inferred fields (Invariant 7).
  manualBrief?: Partial<Pick<OrgClassification,
    "productCategory" | "targetUser" | "stage" | "campaignGoal" | "region">>;
  websiteText?: string; // optional, from Unit 12 later; ignored by the mock
};

export type ClassifyKolContentInput = {
  handle: string;
  profile: TwitterUser | null;
  posts: Tweet[];
  replies?: Tweet[];
};

export type ClassifyAudienceInput = {
  accounts: EngagedAccountRaw[];
};

export type GenerateFitReportInput = {
  org: { handle: string; classification: OrgClassification };
  kol: { handle: string; content: KolContentClassification };
  audience: AudienceClassification;
  // Deterministic results from packages/scoring (Unit 14). The LLM does NOT
  // compute these — it places them into the report and writes narrative around
  // them. Optional now (no scoring yet); the mock uses clearly-marked
  // placeholders when absent.
  scores?: ScoreBreakdown;
  verdict?: ReportVerdict;
  sampleSizes?: Record<string, number>;
};
```

**The scoring boundary (critical):** `generateFitReport` returns a `FitReport`, but every numeric field in it (`overallScore.value`, `paidPromo.riskScore`, `botFarmRisk.riskScore`, `brandSafety.score`, `geoLanguageFit.score`) and the `verdict` come from `input.scores` / `input.verdict` — passed **through**, never invented by the LLM. When those inputs are absent (Unit 11 has no scoring yet), the mock emits placeholder values (`0`, `confidence: "low"`, `verdict: "OKAY"`) and an evidence note saying scores are pending Unit 14. The LLM's real contribution is the **narrative** (best/weak use cases, section summaries, recommended angle, audience-match prose).

## Mock LLM Behavior

Deterministic and network-free — no `Math.random()` without a seed, no `Date.now()`; identical inputs → deep-equal outputs (reliable for Unit 13 tests). The mock has **no prompts**; it computes structured outputs directly from the inputs.

- **`classifyOrgProfile`:** returns a stable `OrgClassification`. Any `manualBrief` field present is echoed verbatim into the corresponding output field (Invariant 7 — manual overrides inferred); missing fields get deterministic inferred placeholders derived from the handle/bio; `keywords` a small stable set; `confidence` `"medium"` (or `"low"` when the profile is null / little data).
- **`classifyKolContent`:** stable `KolContentClassification` (themes, verticals, style, depth, `promoPatterns`, `repeatedTickers`) derived deterministically from the posts (e.g. simple keyword/ticker extraction over `input.posts`). This carries the paid-promo *signal* (`promoPatterns`).
- **`classifyAudienceAccounts`:** the genuinely useful bit for Unit 13 — classifies each input `EngagedAccountRaw` into an `AudienceBucket` by **deterministic keyword rules over the account's bio/handle** (e.g. "solidity/engineer" → `developers`, "founder/cofounder" → `founders`, "airdrop/points/quests" → `airdrop_farmers`, "wen moon/memecoin/$" → `meme_degens`, empty bio + generic numeric handle → `bots_spam`, "lp/yield/delta-neutral" → `defi_users`, "perps/trader" → `traders`, else `non_crypto`), then builds the `distribution` (per-bucket `count` + `share`, `sampleSize` = accounts length). Rules living in `packages/llm` are the mock's stand-in for what the real LLM does via prompts; they are **classification, not scoring** (counts/shares are deterministic aggregation, not fit scores).
- **`generateFitReport`:** returns a valid `FitReport`. Numeric scores + verdict come from `input.scores`/`input.verdict` (placeholders when absent, per the boundary above). Narrative fields filled deterministically from the classifications + audience distribution: `audienceMatch.summary`, `contentAnalysis` (echoes the kol content classification + a summary), `audienceBreakdown` (from `input.audience.distribution`), `paidPromo`/`botFarmRisk`/`brandSafety`/`geoLanguageFit` narratives, `bestUseCases`/`weakUseCases`, `recommendedAngle`, and `evidence.notes` (including a clear "mock LLM" marker). `schemaVersion` = `REPORT_SCHEMA_VERSION`.
- **Determinism mechanism:** derive any variability from a stable string hash of the inputs (handles/ids), never randomness/time.

## Configuration / Provider Selection Behavior

```ts
export function createLlmProvider(options?: {
  kind?: LlmProviderKind;
  model?: string;
}): LlmProvider;
```

- **Kind resolution:** `options.kind` → `process.env.LLM_PROVIDER` → default `"mock"`.
- **Model resolution:** `options.model` → `process.env.LLM_MODEL` → for the mock, a `"mock"` sentinel when unset (the mock ignores the value but exposes it as `provider.model`). The **live OpenAI** provider (Unit 17) will *require* `LLM_MODEL` and error if missing — noted, not implemented here.
- `"mock"` → returns `MockLlmProvider`. `"openai"` → throws a clear `Error("OpenAI provider is not implemented yet (Unit 17).")`.
- The mock is also exported directly (`MockLlmProvider` / `createMockLlmProvider({ model? })`) so Unit 13 tests can construct it without env.
- **Env var:** add optional `LLM_PROVIDER=mock` to `.env.example` (commented, defaulted, so nothing breaks unset). `LLM_MODEL` already exists in `.env.example` (Unit 01) — it is *plumbed* through config here, its concrete value still chosen in Unit 17.

## Prompt Boundary Rules

These govern the package boundary; the mock has no prompts, but the rules define what the live provider (Unit 17) must obey and what the mock stands in for:

- **All prompt construction, model calls, and provider-specific formatting stay inside `packages/llm`.** No prompt strings, model ids, or OpenAI specifics leak into the pipeline, worker, API, or UI. Callers only see the typed interface + shared schemas.
- **LLMs receive compact structured evidence, not raw payloads** (Invariant 15 / code-standards). The input types above are the contract.
- **LLM output is classification + narrative only.** It must **not** produce final numeric fit/risk scores — those are deterministic (`packages/scoring`, Unit 14) and enter `generateFitReport` as input.
- **Every output is validated against its shared Zod schema before it is trusted or returned** (Invariants 9, 12). Invalid output is a failure, not a saved report; retry/repair-prompt handling is the live provider's concern (Unit 17).
- **Model id is configuration, never hardcoded**; it is recorded with reports (`Report.llmModel`) along with the report schema version.
- **Secrets/API keys only from env, only in the live provider (Unit 17)**; never logged or returned.

## Implementation Steps

1. **Deps for `packages/llm`:** add `@kol-fit/shared` (`workspace:*`) and `@types/node` (dev, for `process.env`); add `"types": ["node"]` to `packages/llm/tsconfig.json`. No `zod` direct dep — reuse shared schemas for validation. No OpenAI SDK.
2. **`src/provider.ts`** — the `LlmProvider` interface, `LlmProviderKind`, and the input type aliases (`ClassifyOrgInput`, `ClassifyKolContentInput`, `ClassifyAudienceInput`, `GenerateFitReportInput`).
3. **`src/mock/classify.ts`** (or `fixtures.ts`) — deterministic helpers: the bio/handle → `AudienceBucket` rule set, distribution builder, keyword/ticker extraction, and stable placeholder generators.
4. **`src/mock/provider.ts`** — `MockLlmProvider implements LlmProvider` (constructed with a `model`), all four methods computing outputs deterministically and `*.parse()`-validating each output against its shared schema before returning; `createMockLlmProvider({ model? })`.
5. **`src/factory.ts`** — `createLlmProvider(options?)` (kind + model resolution; `"openai"` throws not-implemented).
6. **`src/index.ts`** — barrel: interface + `LlmProviderKind` + input types, `createLlmProvider`, `MockLlmProvider`/`createMockLlmProvider`. Replace the `PACKAGE_NAME` placeholder.
7. **`.env.example`** — add the optional `LLM_PROVIDER=mock` line (a short comment); leave `LLM_MODEL` as-is.
8. **Do not touch** `apps/*`, other `packages/*`, or the Prisma schema.

## Dependencies

- New workspace dep on `packages/llm`: `@kol-fit/shared`.
- New dev dep: `@types/node` (for `process.env`).
- **No** OpenAI SDK, no HTTP/network library (that's Unit 17); no `zod` direct dep (shared schemas reused).

## Environment Variables

- `LLM_MODEL` — already in `.env.example` (Unit 01). Plumbed through `createLlmProvider` here (→ `provider.model`); the mock ignores its value; the concrete model is chosen in Unit 17. Never hardcoded.
- `LLM_PROVIDER` — new, optional, default `"mock"`; add to `.env.example`. Selects mock vs openai.
- No secrets used this unit (`OPENAI_API_KEY` is Unit 17).

## Verification Checklist

All checks are **offline and disk-light** (no DB, no Postgres, no browser, no network — just `pnpm build` + a small `node -e` against the built package, optionally feeding the Unit 10 Twitter mock's accounts):

- [ ] `pnpm build` passes across all workspace projects (`packages/llm` compiles; nothing else changes).
- [ ] **Provider selection:** `createLlmProvider()` and `{ kind: "mock" }` return a mock; `{ kind: "openai" }` throws the clear "not implemented yet (Unit 17)" error; `LLM_PROVIDER=mock` env resolves to the mock.
- [ ] **Model plumbing:** `createLlmProvider({ model: "test-model" }).model === "test-model"`; `LLM_MODEL` env populates `provider.model`; unset → `"mock"` sentinel. No real model name hardcoded in the source.
- [ ] **Outputs validate** against shared schemas: `classifyOrgProfile` → `OrgClassificationSchema`; `classifyKolContent` → `KolContentClassificationSchema`; `classifyAudienceAccounts` → `AudienceClassificationSchema`; `generateFitReport` → `FitReportSchema`.
- [ ] **Determinism:** each method returns deep-equal output for identical input across two calls.
- [ ] **Manual-brief override:** a `manualBrief.productCategory` in `classifyOrgProfile` input appears verbatim in the output (inferred fields do not overwrite it).
- [ ] **Audience classification is useful:** feeding the Unit 10 mock's engaged accounts yields a `distribution` spanning multiple buckets (incl. `developers`/`airdrop_farmers`/`meme_degens`/`bots_spam`), `sampleSize` equals the input account count, and shares are in `[0,1]`.
- [ ] **No score invention:** `generateFitReport` with an `input.scores`/`verdict` echoes those exact numeric values + verdict into the `FitReport`; called **without** them, numeric fields are placeholders (`overallScore.value === 0`, `confidence "low"`) and an evidence note flags scores pending Unit 14 — proving the LLM never computes scores.
- [ ] No network calls occur (mock is pure; no HTTP client / OpenAI SDK imported).

### Scope guardrails

- [ ] All LLM logic is confined to `packages/llm`; no prompt/model specifics leak elsewhere.
- [ ] No worker/pipeline, API route, UI, Prisma schema, scoring, or TwitterAPI.io changes; no live OpenAI.
- [ ] `context/progress-tracker.md` updated once implemented.
- [ ] No commits made.
```
