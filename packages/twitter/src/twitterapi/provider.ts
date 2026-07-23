import type {
  EngagedAccountRaw,
  Tweet,
  TwitterUser,
} from "@kol-fit/shared";

import type { TwitterProvider } from "../provider.js";
import {
  TwitterApiClient,
  type TwitterApiClientOptions,
  type UsageStats,
} from "./client.js";
import { PATHS } from "./endpoints.js";
import { TwitterApiError } from "./errors.js";
import {
  normalizeEngaged,
  normalizeTweet,
  normalizeUser,
} from "./normalize.js";

type Raw = Record<string, unknown>;

/**
 * Pull a named array field out of a response envelope. Live TwitterAPI.io wraps
 * list results under `data` (e.g. `{ status, data: { tweets: [...] } }`) while
 * some docs show them top-level — tolerate both, plus `data` as a bare array.
 */
const arrayField =
  (key: string) =>
  (body: Raw): unknown => {
    if (Array.isArray(body[key])) return body[key];
    const data = body.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const nested = (data as Raw)[key];
      if (Array.isArray(nested)) return nested;
    }
    if (Array.isArray(data)) return data;
    return undefined;
  };

const authorOf = (raw: unknown): unknown =>
  raw && typeof raw === "object" ? (raw as Raw).author : undefined;

const textOf = (raw: unknown): unknown =>
  raw && typeof raw === "object" ? (raw as Raw).text : undefined;

/**
 * Live TwitterAPI.io provider behind the shared TwitterProvider interface. All
 * HTTP + normalization stays here; the pipeline sees only the interface. The
 * API key is read once (from the factory) and only ever sent as a header.
 */
export class TwitterApiProvider implements TwitterProvider {
  private readonly client: TwitterApiClient;

  constructor(options: TwitterApiClientOptions) {
    this.client = new TwitterApiClient(options);
  }

  /** In-memory request/cost counters (not on the interface). */
  getUsageStats(): UsageStats {
    return this.client.getUsageStats();
  }

  async getUserProfile(handle: string): Promise<TwitterUser | null> {
    let body: Raw | null;
    try {
      body = await this.client.fetchOne(PATHS.userInfo, { userName: handle });
    } catch (err) {
      if (err instanceof TwitterApiError && err.code === "not_found") return null;
      throw err;
    }
    if (!body) return null;
    return normalizeUser(body.data);
  }

  async getUserTweets(handle: string, limit: number): Promise<Tweet[]> {
    return this.client.collect<Tweet>(
      PATHS.userLastTweets,
      { userName: handle, includeReplies: false },
      limit,
      arrayField("tweets"),
      (raw) => {
        const t = normalizeTweet(raw);
        return t && t.isReply !== true ? t : null;
      },
      "tweets"
    );
  }

  /** Same fetch as getUserTweets (one page at probe sizes); the SHORT cache
   *  TTL that makes it a freshness probe lives in the caching decorator. */
  async getLatestTweets(handle: string, limit: number): Promise<Tweet[]> {
    return this.getUserTweets(handle, limit);
  }

  async getUserReplies(handle: string, limit: number): Promise<Tweet[]> {
    return this.client.collect<Tweet>(
      PATHS.userLastTweets,
      { userName: handle, includeReplies: true },
      limit,
      arrayField("tweets"),
      (raw) => {
        const t = normalizeTweet(raw);
        return t && t.isReply === true ? t : null;
      },
      "tweets"
    );
  }

  async getTweetReplies(
    tweetId: string,
    limit: number
  ): Promise<EngagedAccountRaw[]> {
    return this.client.collect<EngagedAccountRaw>(
      PATHS.tweetReplies,
      { tweetId },
      limit,
      arrayField("tweets"),
      (raw) => normalizeEngaged(authorOf(raw), tweetId, "REPLY", textOf(raw)),
      "tweets"
    );
  }

  async getTweetQuotes(
    tweetId: string,
    limit: number
  ): Promise<EngagedAccountRaw[]> {
    return this.client.collect<EngagedAccountRaw>(
      PATHS.tweetQuotes,
      { tweetId },
      limit,
      arrayField("tweets"),
      (raw) => normalizeEngaged(authorOf(raw), tweetId, "QUOTE", textOf(raw)),
      "tweets"
    );
  }

  async getTweetRetweeters(
    tweetId: string,
    limit: number
  ): Promise<EngagedAccountRaw[]> {
    return this.client.collect<EngagedAccountRaw>(
      PATHS.tweetRetweeters,
      { tweetId },
      limit,
      arrayField("users"),
      (raw) => normalizeEngaged(raw, tweetId, "RETWEET"),
      "users"
    );
  }

  async getFollowers(handle: string, limit: number): Promise<TwitterUser[]> {
    return this.client.collect<TwitterUser>(
      PATHS.userFollowers,
      { userName: handle, pageSize: 200 },
      limit,
      arrayField("followers"),
      (raw) => normalizeUser(raw),
      "users"
    );
  }

  async searchTweets(query: string, limit: number): Promise<Tweet[]> {
    return this.client.collect<Tweet>(
      PATHS.advancedSearch,
      { query, queryType: "Latest" },
      limit,
      arrayField("tweets"),
      (raw) => normalizeTweet(raw),
      "tweets"
    );
  }
}

export function createTwitterApiProvider(
  options: TwitterApiClientOptions
): TwitterApiProvider {
  return new TwitterApiProvider(options);
}
