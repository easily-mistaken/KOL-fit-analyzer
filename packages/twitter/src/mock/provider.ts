import type {
  EngagedAccountRaw,
  EngagementSource,
  Tweet,
  TwitterUser,
} from "@kol-fit/shared";

import type { TwitterProvider } from "../provider.js";
import {
  SEARCH_RESULTS,
  makeKolPosts,
  makeKolReplies,
  makeProfile,
  selectAccounts,
} from "./fixtures.js";

/**
 * Deterministic, network-free Twitter provider backed by fixtures. Same inputs
 * always yield deep-equal outputs. Used until the live TwitterAPI.io provider
 * lands in Unit 16, and for pipeline tests (Unit 13).
 */
export class MockTwitterProvider implements TwitterProvider {
  async getUserProfile(handle: string): Promise<TwitterUser | null> {
    return makeProfile(handle);
  }

  async getUserTweets(handle: string, limit: number): Promise<Tweet[]> {
    return makeKolPosts(handle).slice(0, Math.max(0, limit));
  }

  async getUserReplies(handle: string, limit: number): Promise<Tweet[]> {
    return makeKolReplies(handle).slice(0, Math.max(0, limit));
  }

  async getTweetReplies(
    tweetId: string,
    limit: number
  ): Promise<EngagedAccountRaw[]> {
    return this.engagers(tweetId, "REPLY", limit);
  }

  async getTweetQuotes(
    tweetId: string,
    limit: number
  ): Promise<EngagedAccountRaw[]> {
    return this.engagers(tweetId, "QUOTE", limit);
  }

  async getTweetRetweeters(
    tweetId: string,
    limit: number
  ): Promise<EngagedAccountRaw[]> {
    return this.engagers(tweetId, "RETWEET", limit);
  }

  async getFollowers(handle: string, limit: number): Promise<TwitterUser[]> {
    return selectAccounts(`followers:${handle}`, limit);
  }

  async searchTweets(_query: string, limit: number): Promise<Tweet[]> {
    return SEARCH_RESULTS.slice(0, Math.max(0, limit));
  }

  /** Deterministic engaged accounts for a tweet + source. */
  private engagers(
    tweetId: string,
    source: EngagementSource,
    limit: number
  ): EngagedAccountRaw[] {
    return selectAccounts(`${source}:${tweetId}`, limit).map((user) => ({
      user,
      tweetId,
      source,
    }));
  }
}

export function createMockTwitterProvider(): MockTwitterProvider {
  return new MockTwitterProvider();
}
