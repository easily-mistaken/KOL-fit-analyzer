# Unit 17: Live OpenAI LLM Provider

## Goal

Implement the real **OpenAI** provider behind the existing `LlmProvider` interface, selected by `LLM_PROVIDER=openai`. It calls OpenAI with **Structured Outputs** for the four capabilities, validates every response against the shared Zod schemas before returning (Invariants 9/12), retries/repairs on invalid output, tracks token usage, and keeps all OpenAI specifics inside `packages/llm`. The mock provider is untouched and stays the default for offline development.

**Scoring boundary (critical):** the LLM never computes or invents numeric scores or the verdict. `generateFitReport` receives the deterministic `scores`/`verdict` (from `packages/scoring`, Unit 14) as **input**; the model writes only narrative, and the provider assembles the final `FitReport` by injecting those inputs into the score/verdict fields. The report's structured-output schema **excludes every numeric/score field**, so the model is structurally unable to produce scores.

Explicit non-goals (later units / never):

- No worker/pipeline, UI, API-route, Prisma-schema, TwitterAPI.io, or scoring changes.
- No caching or real cost controls beyond in-memory usage counters — **Unit 19 owns cost controls**. The audience-classification cap here is a blunt first-slice bound; **Unit 19 should improve audience sampling (representative selection rather than first-N) and cost controls**.
- No commits. Never hardcode a model or key; never log/print the key; never commit `.env`.

## Official API Grounding

Confirmed from the OpenAI docs (see *Sources*):

- **Endpoint:** `POST https://api.openai.com/v1/responses` (the current recommended **Responses API**). Auth header `Authorization: Bearer $OPENAI_API_KEY`.
- **Request body:** `{ model, input: [{ role, content }], text: { format: { type: "json_schema", name, strict: true, schema } }, max_output_tokens }`.
- **Response:** model text via `output_text` (convenience aggregate) or walk `output[].content[]` for items with `type: "output_text"` (`.text`); a model refusal appears as a `refusal` field/content item.
- **Usage:** `usage.input_tokens`, `usage.output_tokens`, `usage.total_tokens`.
- **Strict JSON Schema rules:** every object sets `additionalProperties: false` and lists **all** properties in `required`; optional fields are expressed as nullable (`type: ["string","null"]`) but still required; `enum`/`minimum`/`maximum` are supported; nesting/array size should be bounded. **Open-ended records are not expressible** under strict mode — so the model-facing schemas avoid records entirely (see Structured Output Strategy).
- Structured Outputs needs GPT‑4o or newer; the concrete model is operator-chosen via `LLM_MODEL` (never hardcoded; docs suggest a current default like `gpt-5.5` for new projects, but the code reads env).

## OpenAI Provider Design

New code under `packages/llm/src/openai/` (mock + interface untouched):

```
packages/llm/src/
  provider.ts            # LlmProvider interface + input types (unchanged)
  factory.ts             # add the "openai" branch (currently throws)
  mock/                  # unchanged
  openai/
    errors.ts            # OpenAiError + OpenAiErrorCode
    client.ts            # POST /v1/responses: auth, timeout, error mapping, usage, injectable fetchImpl
    schemas.ts           # hand-authored strict JSON Schemas per method (request-side)
    prompts.ts           # system+user prompt builders (compact evidence; no-scores instruction)
    normalize.ts         # null→undefined coercion; assemble AudienceClassification + FitReport
    provider.ts          # OpenAiLlmProvider implements LlmProvider
```

- `OpenAiLlmProvider` is constructed with `{ apiKey, model, baseUrl?, timeoutMs?, maxRetries?, fetchImpl? }`. `fetchImpl` defaults to global `fetch` and is **injectable** so verification runs fully offline against canned OpenAI JSON. `model` (from `LLM_MODEL`) is exposed as the interface's `readonly model` and recorded on `Report.llmModel` (already wired by the worker).
- The provider depends only on the shared schemas/types + its client. It never imports the mock. Swappability preserved: `createLlmProvider()` returns mock or live by config; both satisfy the interface, so the pipeline/worker are unaffected.
- The key is read once (from the factory) and only ever sent as the `Authorization` header — never logged, thrown, or included in error messages.

## Method Mapping to the `LlmProvider` Interface

| Method | Model returns (structured) | Provider assembles → validates |
| --- | --- | --- |
| `classifyOrgProfile` | Org classification object (fields per `OrgClassification`) | null→undefined coerce → `OrgClassificationSchema` |
| `classifyKolContent` | Kol content object (per `KolContentClassification`) | coerce → `KolContentClassificationSchema` |
| `classifyAudienceAccounts` | **array of per-account** `{ accountId, handle, source, bucket, signals }` (no record, no percentages) — **capped slice**, batched | provider computes `distribution` (counts/shares/sampleSize) deterministically over the classified accounts → `AudienceClassificationSchema` |
| `generateFitReport` | **narrative-only** object (best/weak use cases, section summaries/narratives, signals, recommendedAngle, evidence notes) — **no scores/verdict** | provider injects input `scores`/`verdict`/`audience.distribution`/`kol.content` into the spine + section score fields → `FitReportSchema` |

- **Audience aggregation stays in code, not the model:** the model assigns each account a `bucket` (+ light signals); the provider counts them into the `AudienceDistribution` (`count`, `share`, `sampleSize`). This keeps counting/scoring out of the LLM and avoids the unsupported record in the model schema.
- **Report scores never come from the model:** the spine (`overallScore`, `verdict`, `confidence`, `evidence.sampleSizes`) and each section's `ScoreValue` (`audienceMatch.score`, `paidPromo.riskScore`, `botFarmRisk.riskScore`, `brandSafety.score`, `geoLanguageFit.score`) are filled from `input.scores`/`input.verdict`/`input.sampleSizes`. The model supplies only prose.

### Audience classification cap (confirmed design)

To avoid classifying every collected engaged account (up to `ANALYSIS_CAPS.maxUniqueEngagedAccounts` = 1500) through OpenAI on every run:

- A configurable cap **`OPENAI_AUDIENCE_CLASSIFICATION_LIMIT` (default 300)** bounds how many accounts the OpenAI provider sends for per-account bucket labeling. Read once at construction (env → default 300); optional constructor override for tests.
- If more accounts are provided than the cap, the provider classifies **only the first deterministic capped slice** (`input.accounts.slice(0, cap)` — input order is already deterministic from the pipeline's dedupe) — no random sampling for now.
- The LLM assigns a `bucket` (+ light signals) **per account only**; it must **not** emit aggregate counts or percentages. The provider computes the `AudienceDistribution` (`count`, `share`, `sampleSize`) deterministically over the classified slice, and `distribution.sampleSize` = the **classified** count (`min(cap, total)`).
- **Both counts are recorded clearly** so confidence can reflect the capped sample: `distribution.sampleSize` = LLM-classified count; the **total** collected count remains recorded by the pipeline as `FitReport.evidence.sampleSizes.engagedAccounts` / `Report.sampleSize.engagedAccounts` (existing). To make the relationship explicit, the pipeline additionally records `engagedAccountsClassified` in `evidence.sampleSizes` (= `audience.distribution.sampleSize`) — **the one small, justified pipeline touch** in `run-analysis.ts` (see below). No scoring change; wiring confidence to key off the classified count is deferred (Unit 19).
- This mock-vs-live is transparent: the mock classifies all input accounts (small fixtures), so `engagedAccountsClassified == engagedAccounts` there; only the live provider caps.

> **Justified pipeline touch:** the scope says don't modify the pipeline unless required and to explain first. Recording `engagedAccountsClassified` (from `audience.distribution.sampleSize`) alongside the existing total is explicitly required by this unit's "record both counts clearly" rule. It is a single additive key in the `sampleSizes` object passed to `generateFitReport` (no type change — `evidence.sampleSizes` is an open `Record<string, int>`), no logic/scoring change, harmless for the mock.

## Structured Output Strategy

- Each method sends `text.format = { type: "json_schema", name, strict: true, schema }` with a **hand-authored** strict schema in `schemas.ts` (small, model-facing; not auto-derived from Zod, to stay within strict-mode limits and avoid records). Every object is `additionalProperties:false` with all props required; optional string fields are `["string","null"]`; enums use the shared vocab (`AudienceBucket` 15 values, `EngagementSource`, `ConfidenceLevel`); `signals.botScore` uses `minimum:0`/`maximum:1`.
- **The shared Zod schema is the trust boundary.** After the model returns, the provider: parses `output_text` as JSON → coerces `null`→`undefined` for optional fields (strict mode returns `null` for absent optionals; Zod `.optional()` expects `undefined`) → assembles (audience distribution / report spine+sections) → `safeParse` against the shared schema. Structured Outputs raises the odds of valid JSON; Zod guarantees it.
- **`classifyAudienceAccounts` batching + cap:** the provider first takes the capped slice (`OPENAI_AUDIENCE_CLASSIFICATION_LIMIT`, default 300), then chunks it into batches of **≤100 accounts/request** to respect context/token limits; per-batch label arrays are concatenated, then the distribution is computed once over the classified accounts. Bounded number of requests (≤ `ceil(cap/100)`); no caching. The model returns labels only — never aggregate percentages.

## Prompt / Input Boundaries

- All prompts live in `prompts.ts` inside `packages/llm`; no prompt text, model id, or OpenAI specifics leak into the pipeline/worker/UI.
- Prompts receive **compact structured evidence, never raw payloads** (Invariant 15 / code-standards): profile summary + a bounded sample of post texts (truncated, top‑K), the org brief, the classification objects — not full tweet dumps. Post/account volume in a prompt is capped to control tokens (respecting `ANALYSIS_CAPS`; this is prompt sizing, not Unit 19 caching).
- **No-scores rule enforced two ways:** (1) the `generateFitReport` schema contains **no** numeric/score/verdict fields, and (2) the prompt explicitly states the deterministic scores + verdict are final and the model must write narrative only — it must not output, restate, or alter any numbers. Manual-brief fields override inferred org fields (Invariant 7), stated in the org prompt.
- Never place secrets/keys in prompts. System prompt sets the analyst role + strict-JSON expectation.

## Output Validation Behavior

- Every method validates its final (assembled) object against the shared schema before returning (Invariant 12). No path returns unvalidated model output.
- **Invalid output** (JSON parse failure, Zod failure, empty output, or a `refusal`) triggers a bounded **repair retry** (`maxRetries`, default 1): the provider re-requests with a short repair instruction summarizing the validation error (no secrets, no scores) and a slightly higher token budget. If it still fails → throw a typed `OpenAiError("invalid_response", …)` (or `"refusal"`). **Invalid JSON is never silently accepted or coerced into a partial report.**
- On a hard provider failure the error propagates so the worker records the job FAILED (existing behavior) — the pipeline never persists an unvalidated report.

## Error Handling

`errors.ts` defines `class OpenAiError extends Error` with `code: OpenAiErrorCode` (message never contains the key):

| code | Cause |
| --- | --- |
| `auth_error` | HTTP 401/403 |
| `rate_limited` | HTTP 429 |
| `provider_error` | HTTP 5xx / unexpected error status |
| `timeout` | request aborted after `timeoutMs` |
| `network_error` | connection failure / non-JSON body |
| `invalid_response` | valid HTTP but output failed JSON/Zod after retries |
| `refusal` | model returned a refusal |
| `config_error` | missing `OPENAI_API_KEY` or `LLM_MODEL` (fail-fast, from factory) |

- `AbortController` timeout (default 60000ms for LLM latency; override `OPENAI_TIMEOUT_MS`). No key/PII in messages.

## Token / Usage Metadata Behavior

- In-memory only (no interface/DTO/schema change — Unit 19 owns real cost controls): the client accumulates `requests`, `inputTokens`, `outputTokens`, `totalTokens`, and per-method request counts from each response's `usage`.
- Exposed via a concrete-only `getUsageStats(): LlmUsageStats` on `OpenAiLlmProvider` (**not** on the `LlmProvider` interface, so the mock and all callers are unaffected). Optionally a single `console.debug` summary per run — never the key.

## Provider Selection Behavior

- `factory.ts`: replace the `"openai"` throw with `new OpenAiLlmProvider({ apiKey, model })` where `apiKey = process.env.OPENAI_API_KEY`, `model = options.model ?? process.env.LLM_MODEL`. **Fail fast** with `OpenAiError("config_error", …)` if `OPENAI_API_KEY` or `LLM_MODEL` is missing/empty — no silent fallback to mock, no hardcoded model.
- Resolution order unchanged (`options.kind` → `LLM_PROVIDER` → `"mock"`); mock stays the **default**. Both providers implement the interface, so pipeline/worker are untouched.

## Offline Verification Strategy

Fully offline, no network, no real key — inject `fetchImpl` returning canned OpenAI Responses JSON:

- Each of the 4 methods: assert the request went to `/v1/responses` with `Authorization: Bearer …`, the right `model`, `text.format.type:"json_schema"` + `strict:true`, and a `max_output_tokens`; assert the returned object validates against the shared schema.
- **Scoring boundary:** feed `generateFitReport` a canned narrative-only response + input `scores`/`verdict`; assert the resulting `FitReport`'s numeric fields equal the **inputs** (not anything from the model), and that the request schema/prompt contain no score fields (grep the built schema).
- **Audience batching + aggregation:** feed >batch-size accounts across multiple canned responses; assert distribution counts/shares/sampleSize computed in code and the whole validates.
- **null→undefined coercion:** a response with `null` optionals validates.
- **Retry/repair:** first canned response invalid (bad JSON / Zod fail / refusal), second valid → method succeeds and made 2 requests; both invalid → throws `invalid_response`/`refusal` (no partial report).
- **Error mapping:** 401/429/500/timeout(AbortError)/non-JSON → correct `OpenAiError.code`; **the key never appears** in any thrown message (grep: key only from env, only in `Authorization`).
- **Factory:** `openai` + key + model → `OpenAiLlmProvider`; missing key or model → `config_error`; mock still default; determinism given identical canned responses.

## Optional Live Verification Strategy

Opt-in, **only when `OPENAI_API_KEY` and `LLM_MODEL` are present** (skipped otherwise; never in CI):

- I will not ask for keys in chat. To run it, add to local `.env`: `LLM_PROVIDER=openai`, `OPENAI_API_KEY=…`, `LLM_MODEL=…` (a Structured-Outputs-capable model, GPT‑4o+). The check reads them from env.
- A minimal guarded script calls `classifyOrgProfile` once with a small `max_output_tokens` and asserts a schema-valid `OrgClassification`; optionally one `generateFitReport` with fixed input scores to confirm the numbers pass through unchanged. Minimize tokens/cost; print only field presence + token counts — never the key.

## Implementation Steps

1. `openai/errors.ts` — `OpenAiError` + `OpenAiErrorCode`.
2. `openai/client.ts` — `respond({ schemaName, schema, system, user, maxOutputTokens })`: build request, `Authorization` header, `AbortController` timeout, POST `/v1/responses`, HTTP→code mapping, extract `output_text` (walk `output[].content[]` fallback), detect `refusal`, accumulate `usage`, injectable `fetchImpl`, usage counters + `getUsageStats()`.
3. `openai/schemas.ts` — hand-authored strict JSON Schemas for org / kol-content / audience-batch / report-narrative.
4. `openai/prompts.ts` — system + per-method user prompt builders (compact evidence; org manual-brief override; report no-scores instruction).
5. `openai/normalize.ts` — null→undefined coercion; `assembleAudienceClassification(accountResults)` (deterministic distribution); `assembleFitReport(narrative, input)` (inject scores/verdict/audience/content).
6. `openai/provider.ts` — `OpenAiLlmProvider implements LlmProvider`: the 4 methods (build prompt+schema → `respond` → parse → coerce → assemble → shared `safeParse` → repair-retry → typed error), `readonly model`, `getUsageStats()`; audience **capped slice (`OPENAI_AUDIENCE_CLASSIFICATION_LIMIT`) + ≤100 batching**, deterministic distribution over classified accounts.
7. `factory.ts` — implement the `"openai"` branch (read `OPENAI_API_KEY`+`LLM_MODEL`, fail-fast, construct provider; pass the audience cap from env).
8. `index.ts` — export `OpenAiLlmProvider` + `OpenAiError`/`OpenAiErrorCode` + `LlmUsageStats`; keep mock exports.
9. `.env.example` — document optional `OPENAI_BASE_URL` / `OPENAI_TIMEOUT_MS` / `OPENAI_AUDIENCE_CLASSIFICATION_LIMIT=300`; `OPENAI_API_KEY`/`LLM_MODEL` already present (leave empty; note structured outputs need GPT‑4o+). No secrets committed.
10. `packages/analysis/src/pipeline/run-analysis.ts` — **the one small justified pipeline touch**: add `engagedAccountsClassified: audience.distribution.sampleSize` to the `sampleSizes` passed to `generateFitReport` (records the LLM-classified count alongside the existing total `engagedAccounts`). Additive key only; no type/logic/scoring change.
11. Confirm **no** other changes to the interface, mock, pipeline, worker, API routes, UI, or Prisma schema.

## Dependencies

- **No new npm packages** — raw `fetch` to `/v1/responses` (global `fetch`/`AbortController`, Node 22); `@types/node` already present (Unit 11). Validation reuses `@kol-fit/shared` schemas (already a dep). No `openai` SDK (keeps deps minimal and the transport injectable for offline tests).

## Environment Variables

- `OPENAI_API_KEY` — **required** when `LLM_PROVIDER=openai`; env only, never hardcoded/logged/committed. Already in `.env.example`.
- `LLM_MODEL` — **required** for the live provider; the model id, never hardcoded in code. Already in `.env.example`.
- `LLM_PROVIDER=openai` — selects the live provider (default `mock`). Already present.
- `OPENAI_BASE_URL` — optional override (default `https://api.openai.com/v1`); useful to point tests at a mock server.
- `OPENAI_TIMEOUT_MS` — optional per-request timeout (default `60000`).
- `OPENAI_AUDIENCE_CLASSIFICATION_LIMIT` — optional; max engaged accounts sent to OpenAI for per-account bucket labeling (default `300`). Bounds live cost; accounts beyond it are not classified this unit (Unit 19 improves sampling).

## Verification Checklist

Offline (primary — no network, no real key):
- [ ] `pnpm build` passes across all workspace projects.
- [ ] Each of the 4 methods, driven by injected `fetchImpl` with canned Responses JSON, sends `/v1/responses` + `Bearer` auth + `text.format` strict `json_schema` + `model` from `LLM_MODEL`, and returns output validating against the shared schema.
- [ ] `generateFitReport` numeric fields (overall, verdict, section scores, confidence) come **only** from input `scores`/`verdict`; the report schema/prompt contain **no** score/verdict fields (grep).
- [ ] Audience: >batch-size accounts → multiple requests, distribution counts/shares/sampleSize computed in code, whole validates; `null` optionals coerced and validate.
- [ ] Audience cap: with more accounts than `OPENAI_AUDIENCE_CLASSIFICATION_LIMIT`, only the first `cap` (deterministic slice) are classified, batches are ≤100, `distribution.sampleSize === min(cap, total)`, and the request count is `ceil(cap/100)`; the model output carries no aggregate percentages. The pipeline records both `engagedAccounts` (total) and `engagedAccountsClassified` (= `distribution.sampleSize`) in `evidence.sampleSizes`.
- [ ] Retry/repair: invalid-then-valid → succeeds in 2 requests; invalid-twice → `invalid_response`/`refusal` (no partial report persisted/returned).
- [ ] Error mapping 401/429/500/AbortError/non-JSON → correct `OpenAiError.code`; **API key never in any thrown message/log** (grep: key only read from env, only in `Authorization`).
- [ ] Factory: `openai`+key+model → `OpenAiLlmProvider`; missing key or model → `config_error`; mock still default; determinism on identical canned responses.
- [ ] Token usage accumulated from `usage.*` and exposed via `getUsageStats()` (not on the interface).

Optional live (manual, only with `OPENAI_API_KEY`+`LLM_MODEL` in `.env`):
- [ ] `classifyOrgProfile` returns a schema-valid `OrgClassification`; minimal tokens; no key printed.

Scope guardrails:
- [ ] All OpenAI logic confined to `packages/llm/src/openai/`; interface + mock unchanged; no pipeline/worker/UI/API-route/Prisma/TwitterAPI.io/scoring changes; no caching.
- [ ] LLM computes no numeric scores anywhere (grep: provider does no arithmetic on score values; report scores sourced from input).
- [ ] `context/progress-tracker.md` updated once implemented. No commits.

## Sources

- [Structured model outputs (Responses API, `text.format` json_schema, strict rules)](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Introducing Structured Outputs in the API](https://openai.com/index/introducing-structured-outputs-in-the-api/)
- [Migrate to the Responses API](https://platform.openai.com/docs/guides/migrate-to-responses)
- [OpenAI API Platform Documentation](https://developers.openai.com/api/docs)
