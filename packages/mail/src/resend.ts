import { MailError } from "./errors.js";
import type { MailProvider, SendMailInput, SendMailResult } from "./provider.js";

// The `resend` SDK is loaded lazily so it is NOT a build/install dependency
// until real email is enabled. A non-literal specifier keeps the import out of
// static type resolution.
const RESEND_MODULE = "resend";

type ResendClient = {
  emails: {
    send(payload: Record<string, unknown>): Promise<{
      data?: { id?: string } | null;
      error?: { message?: string; name?: string } | null;
    }>;
  };
};

/**
 * Real email via Resend. Requires RESEND_API_KEY and MAIL_FROM. The SDK is
 * imported at construction time; if it isn't installed we fail with a clear
 * config error rather than a cryptic module error.
 */
export class ResendMailProvider implements MailProvider {
  readonly kind = "resend" as const;
  private constructor(
    private readonly client: ResendClient,
    private readonly from: string,
    private readonly replyTo?: string
  ) {}

  static async create(): Promise<ResendMailProvider> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.MAIL_FROM?.trim();
    if (!apiKey) {
      throw new MailError("config_error", "RESEND_API_KEY is not set.");
    }
    if (!from) {
      throw new MailError("config_error", "MAIL_FROM is not set.");
    }
    let mod: { Resend: new (key: string) => ResendClient };
    try {
      mod = (await import(RESEND_MODULE)) as unknown as {
        Resend: new (key: string) => ResendClient;
      };
    } catch {
      throw new MailError(
        "config_error",
        "The `resend` package is not installed; run `pnpm add resend` in the worker to enable real email."
      );
    }
    return new ResendMailProvider(
      new mod.Resend(apiKey),
      from,
      process.env.MAIL_REPLY_TO?.trim() || undefined
    );
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    try {
      const res = await this.client.emails.send({
        from: this.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(this.replyTo ? { reply_to: this.replyTo } : {}),
        attachments: (input.attachments ?? []).map((a) => ({
          filename: a.filename,
          content: a.content, // Buffer accepted by the Resend SDK
        })),
      });
      if (res.error) {
        throw new MailError(
          "provider_error",
          res.error.message ?? "Resend rejected the email."
        );
      }
      return { id: res.data?.id };
    } catch (err) {
      if (err instanceof MailError) throw err;
      throw new MailError(
        "provider_error",
        err instanceof Error ? err.message : "Failed to send email."
      );
    }
  }
}
