export type OpenAiErrorCode =
  | "auth_error"
  | "rate_limited"
  | "provider_error"
  | "timeout"
  | "network_error"
  | "invalid_response"
  | "refusal"
  | "config_error";

/**
 * Typed error for the OpenAI provider. Messages never contain the API key
 * (the key is only ever sent as the Authorization header).
 */
export class OpenAiError extends Error {
  readonly code: OpenAiErrorCode;
  readonly httpStatus?: number;

  constructor(code: OpenAiErrorCode, message: string, httpStatus?: number) {
    super(message);
    this.name = "OpenAiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
