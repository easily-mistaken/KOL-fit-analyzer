import { MailError } from "./errors.js";
import { createMockMailProvider } from "./mock.js";
import type { MailProvider, MailProviderKind } from "./provider.js";
import { ResendMailProvider } from "./resend.js";

/**
 * Selects the mail provider. Resolution: options.kind -> MAIL_PROVIDER -> "mock".
 * Mock is the default (no credentials, logs only); "resend" requires
 * RESEND_API_KEY + MAIL_FROM and is only used when explicitly configured.
 */
export async function createMailProvider(options?: {
  kind?: MailProviderKind;
}): Promise<MailProvider> {
  const kind: MailProviderKind =
    options?.kind ??
    (process.env.MAIL_PROVIDER as MailProviderKind | undefined) ??
    "mock";

  switch (kind) {
    case "mock":
      return createMockMailProvider();
    case "resend":
      return ResendMailProvider.create();
    default:
      throw new MailError("config_error", `Unknown MAIL_PROVIDER: ${String(kind)}`);
  }
}
