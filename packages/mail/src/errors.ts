export type MailErrorCode =
  | "config_error"
  | "auth_error"
  | "provider_error";

/** Typed email error. Messages never contain the API key. */
export class MailError extends Error {
  readonly code: MailErrorCode;
  constructor(code: MailErrorCode, message: string) {
    super(message);
    this.name = "MailError";
    this.code = code;
  }
}
