import type { MailProvider, SendMailInput, SendMailResult } from "./provider.js";

/**
 * No-op mail provider (default). Logs a compact record of the send so the flow
 * works end-to-end with no credentials, and returns success. Never contacts a
 * real service.
 */
export class MockMailProvider implements MailProvider {
  readonly kind = "mock" as const;

  async send(input: SendMailInput): Promise<SendMailResult> {
    const bytes = (input.attachments ?? []).reduce(
      (n, a) => n + (a.content?.length ?? 0),
      0
    );
    console.log(
      `[mail:mock] would send "${input.subject}" to <${input.to}>` +
        `${input.attachments?.length ? ` with ${input.attachments.length} attachment(s), ${bytes} bytes` : ""}`
    );
    return { id: `mock-${Date.now()}` };
  }
}

export function createMockMailProvider(): MockMailProvider {
  return new MockMailProvider();
}
