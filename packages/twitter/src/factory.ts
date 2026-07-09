import type { TwitterProvider, TwitterProviderKind } from "./provider.js";
import { createMockTwitterProvider } from "./mock/provider.js";
import { createTwitterApiProvider } from "./twitterapi/provider.js";
import { TwitterApiError } from "./twitterapi/errors.js";

/**
 * Selects a Twitter provider. Resolution order:
 *   options.kind -> process.env.TWITTER_PROVIDER -> "mock".
 *
 * Mock stays the default for offline development; "twitterapi" is the live
 * TwitterAPI.io provider (Unit 16), which requires TWITTERAPI_IO_KEY.
 */
export function createTwitterProvider(options?: {
  kind?: TwitterProviderKind;
}): TwitterProvider {
  const kind: TwitterProviderKind =
    options?.kind ??
    (process.env.TWITTER_PROVIDER as TwitterProviderKind | undefined) ??
    "mock";

  switch (kind) {
    case "mock":
      return createMockTwitterProvider();
    case "twitterapi": {
      const apiKey = process.env.TWITTERAPI_IO_KEY?.trim();
      if (!apiKey) {
        // Fail fast — no silent fallback to mock.
        throw new TwitterApiError(
          "auth_error",
          "TWITTERAPI_IO_KEY is not set; cannot use the twitterapi provider."
        );
      }
      return createTwitterApiProvider({ apiKey });
    }
    default:
      throw new Error(`Unknown TWITTER_PROVIDER: ${String(kind)}`);
  }
}
