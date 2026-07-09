import type { TwitterProvider, TwitterProviderKind } from "./provider.js";
import { createMockTwitterProvider } from "./mock/provider.js";

/**
 * Selects a Twitter provider. Resolution order:
 *   options.kind -> process.env.TWITTER_PROVIDER -> "mock".
 *
 * Only the mock exists in Unit 10; "twitterapi" is wired in Unit 16 and throws
 * a clear error until then, so the selection seam is explicit.
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
    case "twitterapi":
      throw new Error(
        "TwitterAPI.io provider is not implemented yet (Unit 16)."
      );
    default:
      throw new Error(`Unknown TWITTER_PROVIDER: ${String(kind)}`);
  }
}
