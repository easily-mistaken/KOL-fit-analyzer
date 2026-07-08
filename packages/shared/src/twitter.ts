import { z } from "zod";

import { EngagementSourceSchema } from "./enums.js";

// Provider-neutral normalized Twitter/X types. Any Twitter provider (mock in
// Unit 10, TwitterAPI.io in Unit 16) must normalize its responses to these
// shapes, which are validated with Zod before entering the pipeline
// (Invariant 9). Only compact metadata is kept, never raw payloads
// (Invariant 15). Counts are optional because providers differ; missing
// optional data lowers confidence rather than breaking (Invariant 8).

export const TwitterUserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  displayName: z.string().optional(),
  bio: z.string().optional(),
  followersCount: z.number().int().min(0).optional(),
  followingCount: z.number().int().min(0).optional(),
  tweetCount: z.number().int().min(0).optional(),
  verified: z.boolean().optional(),
  createdAt: z.string().optional(),
  avatarUrl: z.string().optional(),
});
export type TwitterUser = z.infer<typeof TwitterUserSchema>;

export const TweetSchema = z.object({
  id: z.string(),
  authorId: z.string().optional(),
  authorHandle: z.string().optional(),
  text: z.string(),
  createdAt: z.string().optional(),
  likeCount: z.number().int().min(0).optional(),
  retweetCount: z.number().int().min(0).optional(),
  replyCount: z.number().int().min(0).optional(),
  quoteCount: z.number().int().min(0).optional(),
  viewCount: z.number().int().min(0).optional(),
  isReply: z.boolean().optional(),
  isQuote: z.boolean().optional(),
  lang: z.string().optional(),
});
export type Tweet = z.infer<typeof TweetSchema>;

// A raw engager tied to a tweet, before audience classification. The
// pre-classification counterpart of AudienceAccount.
export const EngagedAccountRawSchema = z.object({
  user: TwitterUserSchema,
  tweetId: z.string(),
  source: EngagementSourceSchema,
});
export type EngagedAccountRaw = z.infer<typeof EngagedAccountRawSchema>;
