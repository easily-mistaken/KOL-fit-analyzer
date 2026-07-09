// Public surface of @kol-fit/twitter: the provider interface, the selection
// factory, and the deterministic mock provider. All Twitter/X-specific logic
// lives inside this package.
export type { TwitterProvider, TwitterProviderKind } from "./provider.js";
export { createTwitterProvider } from "./factory.js";
export {
  MockTwitterProvider,
  createMockTwitterProvider,
} from "./mock/provider.js";
