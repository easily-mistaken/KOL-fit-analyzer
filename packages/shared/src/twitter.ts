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
  /** Free-text profile location (Unit 41 Phase C). Often blank/joke on X;
   *  used only as a best-effort signal for coarse audience-region inference. */
  location: z.string().optional(),
});
export type TwitterUser = z.infer<typeof TwitterUserSchema>;

// Compact media attachment metadata (Unit 29A). For photos `url` is the image
// itself; for video/animated_gif `previewUrl` is the thumbnail (the compact,
// vision-usable representation — full video variants are never stored).
export const TweetMediaSchema = z.object({
  type: z.enum(["photo", "video", "animated_gif"]),
  url: z.string().optional(),
  previewUrl: z.string().optional(),
});
export type TweetMedia = z.infer<typeof TweetMediaSchema>;

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
  media: z.array(TweetMediaSchema).optional(),
});
export type Tweet = z.infer<typeof TweetSchema>;

// A raw engager tied to a tweet, before audience classification. The
// pre-classification counterpart of AudienceAccount. `text` is the reply/quote
// body (absent for retweets; bounded + sanitized at normalization) and
// `appearances` counts how many analyzed posts this account engaged with
// (set by collectEngagedAccounts) — both Unit 29A enrichment fields.
export const EngagedAccountRawSchema = z.object({
  user: TwitterUserSchema,
  tweetId: z.string(),
  source: EngagementSourceSchema,
  text: z.string().optional(),
  appearances: z.number().int().min(1).optional(),
});
export type EngagedAccountRaw = z.infer<typeof EngagedAccountRawSchema>;
