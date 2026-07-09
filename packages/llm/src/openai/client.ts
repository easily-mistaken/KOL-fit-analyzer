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
}

export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_TIMEOUT_MS = 60000;

type Raw = Record<string, unknown>;

export type RespondParams = {
  method: string;
  schemaName: string;
  schema: object;
  system: string;
  user: string;
  maxOutputTokens: number;
};

export type RespondResult = { text: string; refusal: string | null };

function resolveBaseUrl(override?: string): string {
  const raw = (override ?? process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).trim();
  return raw.replace(/\/+$/, "");
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
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchImpl);
  }

  getUsageStats(): LlmUsageStats {
    return { ...this.usage, byMethod: { ...this.usage.byMethod } };
  }

  async respond(params: RespondParams): Promise<RespondResult> {
    this.usage.requests++;
    this.usage.byMethod[params.method] = (this.usage.byMethod[params.method] ?? 0) + 1;

    const requestBody = JSON.stringify({
      model: this.model,
      input: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
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
    });

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
      throw new OpenAiError(code, `OpenAI HTTP ${res.status}`, res.status);
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

    return extractOutput(b);
  }
}
