import type { LlmProvider, LlmProviderKind } from "./provider.js";
import { createMockLlmProvider } from "./mock/provider.js";

/**
 * Selects an LLM provider. Resolution order:
 *   kind:  options.kind  -> process.env.LLM_PROVIDER -> "mock".
 *   model: options.model -> process.env.LLM_MODEL    -> "mock" sentinel (mock only).
 *
 * The model id is configuration, never hardcoded. Only the mock exists in
 * Unit 11; "openai" is wired in Unit 17 and throws until then.
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
    case "openai":
      throw new Error("OpenAI provider is not implemented yet (Unit 17).");
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${String(kind)}`);
  }
}
