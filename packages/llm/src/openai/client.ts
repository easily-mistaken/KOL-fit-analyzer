import { OpenAiError } from "./errors.js";

export type FetchImpl = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<Response>;

export type LlmUsageStats = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  byMethod: Record<string, number>;
};

export interface OpenAiClientOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchImpl;
  /** Responses-API reasoning effort. "off"/"none" omits the param (for
   *  non-reasoning models). Default "minimal" — GPT-5-tier reasoning models
   *  otherwise spend the whole token budget on reasoning and return empty output. */
  reasoningEffort?: string;
}

export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
// Reasoning models generating large structured outputs (e.g. per-account
// audience batches) can exceed a minute; give a generous default.
export const DEFAULT_TIMEOUT_MS = 120000;
export const DEFAULT_REASONING_EFFORT = "minimal";

function resolveTimeoutMs(override?: number): number {
  if (typeof override === "number" && override > 0) return override;
  const fromEnv = Number(process.env.OPENAI_TIMEOUT_MS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_TIMEOUT_MS;
}

type Raw = Record<string, unknown>;

export type RespondParams = {
  method: string;
  schemaName: string;
  schema: object;
  system: string;
  user: string;
  /** Optional image URLs attached as input_image parts after the user text
   *  (Unit 29B multimodal content classification). Requires a vision-capable
   *  model. */
  images?: string[];
  /** Per-call reasoning-effort override (Unit 30: the content-fit judgment
   *  call gets more thinking budget than bulk classification). */
  reasoningEffort?: string;
  maxOutputTokens: number;
};

export type RespondResult = { text: string; refusal: string | null };

function resolveBaseUrl(override?: string): string {
  // Treat an empty/whitespace override or env var as "unset" and fall back to
  // the default — `??` would keep an empty string, yielding a relative URL.
  const base =
    override?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

/** Extract the model's text output + any refusal from a Responses API body. */
function extractOutput(body: Raw): RespondResult {
  if (typeof body.output_text === "string" && body.output_text.length > 0) {
    return { text: body.output_text, refusal: null };
  }
  let text = "";
  let refusal: string | null = null;
  const output = body.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = (item as Raw)?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        const cc = c as Raw;
        if (cc.type === "output_text" && typeof cc.text === "string") text += cc.text;
        else if (cc.type === "refusal" && typeof cc.refusal === "string") refusal = cc.refusal;
      }
    }
  }
  return { text, refusal };
}

/**
 * Low-level OpenAI Responses API client. Holds no report-shape knowledge — it
 * sends a structured-output request and returns raw text; parsing/validation is
 * the provider's job. The API key is only ever sent as the Authorization header
 * and never appears in errors/logs.
 */
export class OpenAiClient {
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchImpl;
  /** null = omit the reasoning param. */
  private readonly reasoningEffort: string | null;
  private readonly usage: LlmUsageStats = {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    byMethod: {},
  };

  constructor(options: OpenAiClientOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = resolveBaseUrl(options.baseUrl);
    this.timeoutMs = resolveTimeoutMs(options.timeoutMs);
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchImpl);
    const eff =
      (options.reasoningEffort ?? "").trim() ||
      (process.env.OPENAI_REASONING_EFFORT ?? "").trim() ||
      DEFAULT_REASONING_EFFORT;
    this.reasoningEffort =
      eff.toLowerCase() === "off" || eff.toLowerCase() === "none" ? null : eff;
  }

  getUsageStats(): LlmUsageStats {
    return { ...this.usage, byMethod: { ...this.usage.byMethod } };
  }

  async respond(params: RespondParams): Promise<RespondResult> {
    this.usage.requests++;
    this.usage.byMethod[params.method] = (this.usage.byMethod[params.method] ?? 0) + 1;

    // Plain string content for text-only calls; structured content parts when
    // images are attached (Responses API: input_text + input_image).
    const userContent =
      params.images && params.images.length > 0
        ? [
            { type: "input_text", text: params.user },
            ...params.images.map((url) => ({
              type: "input_image",
              image_url: url,
            })),
          ]
        : params.user;

    const payload: Record<string, unknown> = {
      model: this.model,
      input: [
        { role: "system", content: params.system },
        { role: "user", content: userContent },
      ],
      text: {
        format: {
          type: "json_schema",
          name: params.schemaName,
          strict: true,
          schema: params.schema,
        },
      },
      max_output_tokens: params.maxOutputTokens,
    };
    // Reasoning models (GPT-5-tier) count reasoning against max_output_tokens;
    // set a low effort so the budget is spent on the structured output, not
    // reasoning (otherwise the response is `incomplete` with empty output).
    const effort = params.reasoningEffort ?? this.reasoningEffort;
    if (effort) {
      payload.reasoning = { effort };
    }
    const requestBody = JSON.stringify(payload);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: requestBody,
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
        throw new OpenAiError("timeout", `Request timed out after ${this.timeoutMs}ms.`);
      }
      throw new OpenAiError("network_error", err instanceof Error ? err.message : "Network request failed.");
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const code =
        res.status === 401 || res.status === 403
          ? "auth_error"
          : res.status === 429
            ? "rate_limited"
            : "provider_error";
      // Surface OpenAI's error message (it describes bad params/schema and never
      // contains the key, which is only sent as a header). Truncated for safety.
      let detail = "";
      try {
        const errBody = (await res.json()) as Raw;
        const m =
          errBody?.error && typeof (errBody.error as Raw).message === "string"
            ? ((errBody.error as Raw).message as string)
            : null;
        if (m) detail = `: ${m.slice(0, 300)}`;
      } catch {
        /* non-JSON error body */
      }
      throw new OpenAiError(code, `OpenAI HTTP ${res.status}${detail}`, res.status);
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new OpenAiError("network_error", "Response body was not valid JSON.");
    }
    if (!body || typeof body !== "object") {
      throw new OpenAiError("invalid_response", "Unexpected OpenAI response envelope.");
    }
    const b = body as Raw;

    if (b.error) {
      const msg =
        typeof b.error === "object" && b.error && typeof (b.error as Raw).message === "string"
          ? ((b.error as Raw).message as string)
          : "OpenAI returned an error.";
      throw new OpenAiError("provider_error", `OpenAI error: ${msg}`);
    }

    const usage = b.usage as Raw | undefined;
    if (usage) {
      this.usage.inputTokens += Number(usage.input_tokens) || 0;
      this.usage.outputTokens += Number(usage.output_tokens) || 0;
      this.usage.totalTokens += Number(usage.total_tokens) || 0;
    }

    // A truncated (e.g. token-limited) response yields empty/partial output;
    // surface it clearly instead of a confusing "not valid JSON".
    if (b.status === "incomplete") {
      const reason = (b.incomplete_details as Raw | undefined)?.reason;
      throw new OpenAiError(
        "invalid_response",
        `OpenAI response was incomplete${typeof reason === "string" ? ` (${reason})` : ""}; increase max_output_tokens or lower reasoning effort.`
      );
    }

    return extractOutput(b);
  }
}
