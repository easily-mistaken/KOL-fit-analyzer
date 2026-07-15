import type { LlmProvider, LlmProviderKind } from "./provider.js";
import { createMockLlmProvider } from "./mock/provider.js";
import { createOpenAiLlmProvider } from "./openai/provider.js";
import { OpenAiError } from "./openai/errors.js";

/**
 * Selects an LLM provider. Resolution order:
 *   kind:  options.kind  -> process.env.LLM_PROVIDER -> "mock".
 *   model: options.model -> process.env.LLM_MODEL    -> "mock" sentinel (mock only).
 *
 * The model id is configuration, never hardcoded. Mock stays the default for
 * offline development; "openai" is the live OpenAI provider (Unit 17), which
 * requires OPENAI_API_KEY and LLM_MODEL.
 */
export function createLlmProvider(options?: {
  kind?: LlmProviderKind;
  model?: string;
}): LlmProvider {
  const kind: LlmProviderKind =
    options?.kind ??
    (process.env.LLM_PROVIDER as LlmProviderKind | undefined) ??
    "mock";

  const model = options?.model ?? process.env.LLM_MODEL;

  switch (kind) {
    case "mock":
      return createMockLlmProvider({ model });
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new OpenAiError("config_error", "OPENAI_API_KEY is not set; cannot use the openai provider.");
      }
      if (!model || model.trim().length === 0) {
        throw new OpenAiError("config_error", "LLM_MODEL is not set; cannot use the openai provider.");
      }
      // Optional cheaper/faster tier for bulk audience batches (Unit 29B) and
      // optional stronger tier for the content-fit judgment call (Unit 30).
      const fastModel = process.env.LLM_MODEL_FAST?.trim() || undefined;
      const fitModel = process.env.LLM_MODEL_FIT?.trim() || undefined;
      return createOpenAiLlmProvider({ apiKey, model: model.trim(), fastModel, fitModel });
    }
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${String(kind)}`);
  }
}
