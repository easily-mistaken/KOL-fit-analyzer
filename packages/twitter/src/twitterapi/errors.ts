export type TwitterApiErrorCode =
  | "auth_error"
  | "rate_limited"
  | "not_found"
  | "provider_error"
  | "timeout"
  | "network_error"
  | "invalid_response";

/**
 * Typed error for the TwitterAPI.io provider. Messages never contain the API
 * key or PII (the key is only ever set as a request header).
 */
export class TwitterApiError extends Error {
  readonly code: TwitterApiErrorCode;
  /** HTTP status when one was received. */
  readonly httpStatus?: number;

  constructor(
    code: TwitterApiErrorCode,
    message: string,
    httpStatus?: number
  ) {
    super(message);
    this.name = "TwitterApiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
