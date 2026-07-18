import {
  AudienceAccountSchema,
  AudienceClassificationSchema,
  ContentFitAssessmentSchema,
  FitReportSchema,
  KolContentClassificationSchema,
  OrgClassificationSchema,
  type AudienceAccount,
  type AudienceClassification,
  type ContentFitAssessment,
  type EngagedAccountRaw,
  type FitReport,
  type KolContentClassification,
  type OrgClassification,
} from "@kol-fit/shared";

import type {
  AssessContentFitInput,
  ClassifyAudienceInput,
  ClassifyKolContentInput,
  ClassifyOrgInput,
  GenerateFitReportInput,
  LlmProvider,
} from "../provider.js";
import {
  OpenAiClient,
  type FetchImpl,
  type LlmUsageStats,
  type RespondParams,
} from "./client.js";
import { OpenAiError } from "./errors.js";
import {
  assembleFitReport,
  buildAudienceDistribution,
  deepNullToUndefined,
} from "./normalize.js";
import {
  KOL_CONTENT_POST_SAMPLE,
  SYSTEM_PROMPT,
  buildAudiencePrompt,
  buildContentFitPrompt,
  buildKolContentPrompt,
  buildOrgPrompt,
  buildReportPrompt,
  repairNote,
  selectPostImages,
} from "./prompts.js";
import { sampleAudienceAccounts } from "./sampling.js";
import {
  AUDIENCE_BATCH_SCHEMA,
  CONTENT_FIT_SCHEMA,
  KOL_CONTENT_SCHEMA,
  ORG_CLASSIFICATION_SCHEMA,
  REPORT_NARRATIVE_SCHEMA,
} from "./schemas.js";

export const DEFAULT_AUDIENCE_LIMIT = 300;
// Smaller batches → faster per-call structured output (a 100-account batch on a
// reasoning model can exceed the request timeout).
const AUDIENCE_BATCH_SIZE = 40;
// Audience batches run concurrently (Unit 29B latency); results stay ordered.
const AUDIENCE_BATCH_CONCURRENCY = 3;
const DEFAULT_MAX_RETRIES = 1;
// Post images attached to the content classification (Unit 29B multimodal).
// 12 -> 16 in Unit 31: live data shows ~40% of sampled posts carry media.
export const DEFAULT_MEDIA_IMAGE_LIMIT = 16;

// Caps (billed only for tokens actually generated). Generous headroom so
// reasoning-model overhead + the structured JSON output both fit. kolContent
// grew in 29B: ~40 per-post labels + safety flags + media labels.
const MAX_TOKENS = {
  org: 2000,
  kolContent: 6000,
  audience: 8000,
  contentFit: 1500,
  report: 4000,
} as const;

export interface OpenAiProviderOptions {
  apiKey: string;
  model: string;
  /** Cheaper/faster model for bulk per-account audience batches (Unit 29B
   *  tiering). Defaults to `model`. */
  fastModel?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchImpl;
  maxRetries?: number;
  audienceLimit?: number;
  mediaImageLimit?: number;
}

/** Bounded-concurrency map; results are input-ordered. */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker)
  );
  return results;
}

type Validated<T> = { ok: true; data: T } | { ok: false; errorSummary: string };

// Structural shape of a Zod error (avoids a direct `zod` dependency here).
type ValidationError = { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> };

function summarize(error: ValidationError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function parseLimit(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
}

/**
 * Live OpenAI LLM provider behind the shared LlmProvider interface. Uses the
 * Responses API with Structured Outputs; the shared Zod schema is the trust
 * boundary. The LLM never computes numeric scores — for the report it writes
 * narrative only and the provider injects the deterministic input scores/verdict.
 */
export class OpenAiLlmProvider implements LlmProvider {
  readonly model: string;
  private readonly client: OpenAiClient;
  /** Separate client for bulk audience batches when fastModel is configured;
   *  otherwise the same instance as `client`. */
  private readonly fastClient: OpenAiClient;
  private readonly maxRetries: number;
  private readonly audienceLimit: number;
  private readonly mediaImageLimit: number;

  constructor(options: OpenAiProviderOptions) {
    this.client = new OpenAiClient(options);
    const fastModel = options.fastModel?.trim();
    this.fastClient =
      fastModel && fastModel !== options.model
        ? new OpenAiClient({ ...options, model: fastModel })
        : this.client;
    this.model = options.model;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.audienceLimit =
      options.audienceLimit ??
      parseLimit(process.env.OPENAI_AUDIENCE_CLASSIFICATION_LIMIT) ??
      DEFAULT_AUDIENCE_LIMIT;
    this.mediaImageLimit =
      options.mediaImageLimit ??
      parseLimit(process.env.OPENAI_MEDIA_IMAGE_LIMIT) ??
      DEFAULT_MEDIA_IMAGE_LIMIT;
  }

  getUsageStats(): LlmUsageStats {
    const clients = [this.client];
    if (this.fastClient !== this.client) clients.push(this.fastClient);
    const stats = clients.map((c) => c.getUsageStats());
    if (stats.length === 1) return stats[0];
    const byMethod: Record<string, number> = {};
    const sum = (k: "requests" | "inputTokens" | "outputTokens" | "totalTokens") =>
      stats.reduce((s, x) => s + x[k], 0);
    for (const s of stats) {
      for (const [k, v] of Object.entries(s.byMethod)) {
        byMethod[k] = (byMethod[k] ?? 0) + v;
      }
    }
    return {
      requests: sum("requests"),
      inputTokens: sum("inputTokens"),
      outputTokens: sum("outputTokens"),
      totalTokens: sum("totalTokens"),
      byMethod,
    };
  }

  /** Request → parse JSON → validate; bounded repair-retry, then typed error. */
  private async requestValidated<T>(
    base: RespondParams,
    validate: (parsed: unknown) => Validated<T>,
    client: OpenAiClient = this.client
  ): Promise<T> {
    let lastError = "";
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const params =
        attempt === 0
          ? base
          : { ...base, user: base.user + repairNote(lastError) };
      const { text, refusal } = await client.respond(params);

      if (refusal) {
        if (attempt === this.maxRetries) {
          throw new OpenAiError("refusal", "OpenAI refused to complete the request.");
        }
        lastError = `model refused: ${refusal}`;
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        if (attempt === this.maxRetries) {
          throw new OpenAiError("invalid_response", "Model output was not valid JSON after retries.");
        }
        lastError = "output was not valid JSON";
        continue;
      }

      const result = validate(parsed);
      if (result.ok) return result.data;
      if (attempt === this.maxRetries) {
        throw new OpenAiError("invalid_response", "Model output failed schema validation after retries.");
      }
      lastError = result.errorSummary;
    }
    /* c8 ignore next */
    throw new OpenAiError("invalid_response", "Model output invalid.");
  }

  async classifyOrgProfile(input: ClassifyOrgInput): Promise<OrgClassification> {
    return this.requestValidated<OrgClassification>(
      {
        method: "classifyOrgProfile",
        schemaName: "org_classification",
        schema: ORG_CLASSIFICATION_SCHEMA,
        system: SYSTEM_PROMPT,
        user: buildOrgPrompt(input),
        maxOutputTokens: MAX_TOKENS.org,
      },
      (parsed) => {
        const r = OrgClassificationSchema.safeParse(deepNullToUndefined(parsed));
        return r.success ? { ok: true, data: r.data } : { ok: false, errorSummary: summarize(r.error) };
      }
    );
  }

  async classifyKolContent(
    input: ClassifyKolContentInput
  ): Promise<KolContentClassification> {
    // Multimodal (Unit 29B): attach a bounded set of post images (photo urls /
    // video thumbnails) from the SAME sample the prompt lists, so mediaLabels
    // postIds always refer to listed posts.
    const { urls, postIds } = selectPostImages(
      input.posts.slice(0, KOL_CONTENT_POST_SAMPLE),
      this.mediaImageLimit
    );
    return this.requestValidated<KolContentClassification>(
      {
        method: "classifyKolContent",
        schemaName: "kol_content",
        schema: KOL_CONTENT_SCHEMA,
        system: SYSTEM_PROMPT,
        user: buildKolContentPrompt(input, postIds),
        images: urls,
        maxOutputTokens: MAX_TOKENS.kolContent,
      },
      (parsed) => {
        const r = KolContentClassificationSchema.safeParse(deepNullToUndefined(parsed));
        return r.success ? { ok: true, data: r.data } : { ok: false, errorSummary: summarize(r.error) };
      }
    );
  }

  async classifyAudienceAccounts(
    input: ClassifyAudienceInput
  ): Promise<AudienceClassification> {
    // Cap: classify a representative deterministic sample (proportional by
    // engagement source, evenly spread within each), then batch. Batches run
    // with bounded concurrency (Unit 29B latency); output stays input-ordered.
    const slice = sampleAudienceAccounts(input.accounts, this.audienceLimit);
    const batches = chunk(slice, AUDIENCE_BATCH_SIZE);
    const perBatch = await mapConcurrent(
      batches,
      AUDIENCE_BATCH_CONCURRENCY,
      (batch) => this.classifyAudienceBatch(batch)
    );
    const accounts: AudienceAccount[] = perBatch.flat();
    const distribution = buildAudienceDistribution(accounts);
    return AudienceClassificationSchema.parse({ accounts, distribution });
  }

  async assessContentFit(
    input: AssessContentFitInput
  ): Promise<ContentFitAssessment> {
    return this.requestValidated<ContentFitAssessment>(
      {
        method: "assessContentFit",
        schemaName: "content_fit",
        schema: CONTENT_FIT_SCHEMA,
        system: SYSTEM_PROMPT,
        user: buildContentFitPrompt(input),
        // The pair-specific content-fit rubric: a little reasoning budget
        // stabilizes borderline adjacency / audience-overlap ratings.
        reasoningEffort: "low",
        maxOutputTokens: MAX_TOKENS.contentFit,
      },
      (parsed) => {
        const r = ContentFitAssessmentSchema.safeParse(deepNullToUndefined(parsed));
        return r.success ? { ok: true, data: r.data } : { ok: false, errorSummary: summarize(r.error) };
      }
    );
  }

  private async classifyAudienceBatch(
    batch: EngagedAccountRaw[]
  ): Promise<AudienceAccount[]> {
    return this.requestValidated<AudienceAccount[]>(
      {
        method: "classifyAudienceAccounts",
        schemaName: "audience_batch",
        schema: AUDIENCE_BATCH_SCHEMA,
        system: SYSTEM_PROMPT,
        user: buildAudiencePrompt(batch),
        maxOutputTokens: MAX_TOKENS.audience,
      },
      (parsed) => {
        const coerced = deepNullToUndefined(parsed) as { accounts?: unknown };
        const model = Array.isArray(coerced?.accounts) ? coerced.accounts : [];
        // Identity fields come from the INPUT (trusted); only bucket + signals
        // come from the model. Never trust the model to echo ids/sources.
        const candidates = [];
        for (let i = 0; i < batch.length && i < model.length; i++) {
          const m = (model[i] ?? {}) as Record<string, unknown>;
          const signals = { ...((m.signals as Record<string, unknown>) ?? {}) };
          // Clamp botScore to [0,1] (no longer constrained in the JSON schema).
          if (typeof signals.botScore === "number") {
            signals.botScore = Math.max(0, Math.min(1, signals.botScore));
          }
          // Region from the model (Unit 41 Phase C2); "unknown"/absent -> omit
          // (matches the mock's convention; scoring treats absent as unplaced).
          const region =
            typeof m.region === "string" && m.region !== "unknown"
              ? m.region
              : undefined;
          candidates.push({
            handle: batch[i].user.handle,
            accountId: batch[i].user.id,
            source: batch[i].source,
            bucket: m.bucket,
            ...(region ? { region } : {}),
            signals,
          });
        }
        const r = AudienceAccountSchema.array().safeParse(candidates);
        return r.success ? { ok: true, data: r.data } : { ok: false, errorSummary: summarize(r.error) };
      },
      // Bulk per-account labeling runs on the fast tier when configured.
      this.fastClient
    );
  }

  async generateFitReport(input: GenerateFitReportInput): Promise<FitReport> {
    return this.requestValidated<FitReport>(
      {
        method: "generateFitReport",
        schemaName: "report_narrative",
        schema: REPORT_NARRATIVE_SCHEMA,
        system: SYSTEM_PROMPT,
        user: buildReportPrompt(input),
        maxOutputTokens: MAX_TOKENS.report,
      },
      (parsed) => {
        const narrative = deepNullToUndefined(parsed) as Record<string, unknown>;
        const assembled = assembleFitReport(narrative, input);
        const r = FitReportSchema.safeParse(assembled);
        return r.success ? { ok: true, data: r.data } : { ok: false, errorSummary: summarize(r.error) };
      }
    );
  }
}

export function createOpenAiLlmProvider(
  options: OpenAiProviderOptions
): OpenAiLlmProvider {
  return new OpenAiLlmProvider(options);
}
