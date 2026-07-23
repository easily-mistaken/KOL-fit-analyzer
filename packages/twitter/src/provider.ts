import type {
  EngagedAccountRaw,
  Tweet,
  TwitterUser,
} from "@kol-fit/shared";

// The Twitter/X data provider interface. All Twitter/X access in the system
// goes through this interface (Invariant 2); implementations normalize their
// responses to the shared provider-neutral types. Method set matches
// architecture.md -> Twitter/X Provider Interface.
export interface TwitterProvider {
  /** Profile for an org or KOL handle. `null` when the account is not found. */
  getUserProfile(handle: string): Promise<TwitterUser | null>;

  /** A user's own posts, newest-first, capped by `limit`. */
  getUserTweets(handle: string, limit: number): Promise<Tweet[]>;

  /** Freshness probe (Unit 48): the newest few posts, identical in shape to
   *  getUserTweets but cached on a SHORT TTL by the caching decorator, so the
   *  activity signal stays current while the deep timeline stays on its long,
   *  cheap TTL. Optional capability: callers must tolerate its absence. */
  getLatestTweets?(handle: string, limit: number): Promise<Tweet[]>;

  /** A user's own replies, newest-first, capped by `limit`. */
  getUserReplies(handle: string, limit: number): Promise<Tweet[]>;

  /** Accounts that replied to a tweet (source REPLY). */
  getTweetReplies(tweetId: string, limit: number): Promise<EngagedAccountRaw[]>;

  /** Accounts that quote-tweeted a tweet (source QUOTE). */
  getTweetQuotes(tweetId: string, limit: number): Promise<EngagedAccountRaw[]>;

  /** Accounts that retweeted a tweet (source RETWEET). */
  getTweetRetweeters(
    tweetId: string,
    limit: number
  ): Promise<EngagedAccountRaw[]>;

  /** Followers of a handle (not tied to a tweet). */
  getFollowers(handle: string, limit: number): Promise<TwitterUser[]>;

  /** Present for interface completeness; minimal in the mock (no discovery). */
  searchTweets(query: string, limit: number): Promise<Tweet[]>;
}

export type TwitterProviderKind = "mock" | "twitterapi";
