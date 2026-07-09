// Public surface of @kol-fit/twitter: the provider interface, the selection
// factory, and the deterministic mock provider. All Twitter/X-specific logic
// lives inside this package.
export type { TwitterProvider, TwitterProviderKind } from "./provider.js";
export { createTwitterProvider } from "./factory.js";
export {
  MockTwitterProvider,
  createMockTwitterProvider,
} from "./mock/provider.js";
// Live TwitterAPI.io provider (Unit 16) — exported for observability/testing.
export {
  TwitterApiProvider,
  createTwitterApiProvider,
} from "./twitterapi/provider.js";
export { TwitterApiError, type TwitterApiErrorCode } from "./twitterapi/errors.js";
export type { UsageStats } from "./twitterapi/client.js";
