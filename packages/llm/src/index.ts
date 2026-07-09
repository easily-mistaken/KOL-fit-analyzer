// Public surface of @kol-fit/llm: the provider interface + call input types, the
// selection factory, and the deterministic mock provider. All LLM-specific
// logic (prompts, model calls, model ids) lives inside this package.
export type {
  LlmProvider,
  LlmProviderKind,
  ClassifyOrgInput,
  ClassifyKolContentInput,
  ClassifyAudienceInput,
  GenerateFitReportInput,
} from "./provider.js";
export { createLlmProvider } from "./factory.js";
export { MockLlmProvider, createMockLlmProvider } from "./mock/provider.js";
