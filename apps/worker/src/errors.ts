import { TwitterApiError } from "@kol-fit/twitter";
import { OpenAiError } from "@kol-fit/llm";

// Stable, user-facing analysis failure codes (Unit 21). These are persisted on
// AnalysisJob.errorCode and shown in the UI — treat them as a stable contract;
// do not rename casually.
export type AnalysisErrorCode =
  | "twitter_auth"
  | "twitter_rate_limited"
  | "twitter_not_found"
  | "twitter_timeout"
  | "twitter_unavailable"
  | "llm_auth"
  | "llm_rate_limited"
  | "llm_invalid_output"
  | "llm_timeout"
  | "llm_config"
  | "llm_unavailable"
  | "analysis_failed";

// Fixed, safe, user-friendly copy per code. We never surface raw provider or
// exception text — only these messages reach the DB/UI, so no key/URL/PII can
// leak through an error path.
const MESSAGES: Record<AnalysisErrorCode, string> = {
  twitter_auth:
    "The X/Twitter data provider rejected our credentials. An operator needs to check the API key.",
  twitter_rate_limited:
    "The X/Twitter data provider is rate-limiting requests right now. Please try again shortly.",
  twitter_not_found:
    "We couldn't find one of the X/Twitter accounts. Double-check the org and KOL handles.",
  twitter_timeout:
    "The X/Twitter data provider took too long to respond. Please try again shortly.",
  twitter_unavailable:
    "The X/Twitter data provider is temporarily unavailable. Please try again shortly.",
  llm_auth:
    "The analysis model provider rejected our credentials. An operator needs to check the API key.",
  llm_rate_limited:
    "The analysis model is rate-limiting requests right now. Please try again shortly.",
  llm_invalid_output:
    "The analysis model returned an unexpected response. Please try again.",
  llm_timeout:
    "The analysis model took too long to respond. Please try again shortly.",
  llm_config:
    "The analysis model is not configured correctly. An operator needs to check the model settings.",
  llm_unavailable:
    "The analysis model provider is temporarily unavailable. Please try again shortly.",
  analysis_failed: "The analysis couldn't be completed. Please try again.",
};

const TWITTER_CODE_MAP: Record<string, AnalysisErrorCode> = {
  auth_error: "twitter_auth",
  rate_limited: "twitter_rate_limited",
  not_found: "twitter_not_found",
  timeout: "twitter_timeout",
  network_error: "twitter_unavailable",
  provider_error: "twitter_unavailable",
  invalid_response: "twitter_unavailable",
};

const LLM_CODE_MAP: Record<string, AnalysisErrorCode> = {
  auth_error: "llm_auth",
  rate_limited: "llm_rate_limited",
  invalid_response: "llm_invalid_output",
  refusal: "llm_invalid_output",
  timeout: "llm_timeout",
  config_error: "llm_config",
  network_error: "llm_unavailable",
  provider_error: "llm_unavailable",
};

// Structural fallback for cross-realm instances where `instanceof` may fail:
// a typed provider error carries a string `.code` and a matching `.name`.
function providerCode(error: unknown, name: string): string | undefined {
  if (
    error &&
    typeof error === "object" &&
    (error as { name?: unknown }).name === name &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

/**
 * Maps any thrown error from the analysis pipeline to a stable, user-facing
 * `{ code, message }`. Provider errors (TwitterApiError/OpenAiError) map by
 * their `.code`; everything else falls back to `analysis_failed`. The returned
 * message is always the fixed copy above — never the raw error text.
 */
export function classifyAnalysisError(error: unknown): {
  code: AnalysisErrorCode;
  message: string;
} {
  const twCode =
    error instanceof TwitterApiError
      ? error.code
      : providerCode(error, "TwitterApiError");
  if (twCode) {
    const code = TWITTER_CODE_MAP[twCode] ?? "twitter_unavailable";
    return { code, message: MESSAGES[code] };
  }

  const llmCode =
    error instanceof OpenAiError
      ? error.code
      : providerCode(error, "OpenAiError");
  if (llmCode) {
    const code = LLM_CODE_MAP[llmCode] ?? "llm_unavailable";
    return { code, message: MESSAGES[code] };
  }

  return { code: "analysis_failed", message: MESSAGES.analysis_failed };
}
