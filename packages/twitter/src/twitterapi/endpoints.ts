// Single source of truth for TwitterAPI.io base URL and paths (all confirmed
// against docs.twitterapi.io). Base URL is overridable for tests/staging.
export const DEFAULT_BASE_URL = "https://api.twitterapi.io";

export function resolveBaseUrl(override?: string): string {
  // Treat an empty/whitespace override or env var as "unset" and fall back to
  // the default — `??` would keep an empty string, yielding a relative URL.
  const base =
    override?.trim() ||
    process.env.TWITTERAPI_IO_BASE_URL?.trim() ||
    DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

export const PATHS = {
  userInfo: "/twitter/user/info",
  userLastTweets: "/twitter/user/last_tweets",
  userFollowers: "/twitter/user/followers",
  tweetReplies: "/twitter/tweet/replies/v2",
  tweetQuotes: "/twitter/tweet/quotes",
  tweetRetweeters: "/twitter/tweet/retweeters",
  advancedSearch: "/twitter/tweet/advanced_search",
} as const;

export const DEFAULT_TIMEOUT_MS = 15000;

// Guard against infinite pagination on stale/looping cursors.
export const DEFAULT_MAX_PAGES = 200;
