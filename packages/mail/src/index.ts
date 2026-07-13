// Public surface of @kol-fit/mail: a provider-agnostic email sender (Unit 24).
export type {
  MailProvider,
  MailProviderKind,
  MailAttachment,
  SendMailInput,
  SendMailResult,
} from "./provider.js";
export { MailError, type MailErrorCode } from "./errors.js";
export { MockMailProvider, createMockMailProvider } from "./mock.js";
export { ResendMailProvider } from "./resend.js";
export { createMailProvider } from "./factory.js";
