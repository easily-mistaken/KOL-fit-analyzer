export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendMailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: MailAttachment[];
};

export type SendMailResult = { id?: string };

export type MailProviderKind = "mock" | "resend";

// All outbound email goes through this interface; implementations map their
// errors to MailError. Secrets/addresses are never logged beyond what a send
// needs.
export interface MailProvider {
  readonly kind: MailProviderKind;
  send(input: SendMailInput): Promise<SendMailResult>;
}
