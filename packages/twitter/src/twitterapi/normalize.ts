import {
  EngagedAccountRawSchema,
  TweetSchema,
  TwitterUserSchema,
  type EngagedAccountRaw,
  type EngagementSource,
  type Tweet,
  type TwitterUser,
} from "@kol-fit/shared";

// Raw TwitterAPI.io payloads are untyped; access defensively and coerce.
type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function int(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

/** Raw user object (data / followers[] / users[] / tweet.author) -> TwitterUser. */
export function normalizeUser(raw: unknown): TwitterUser | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Raw;
  const candidate = {
    id: str(u.id),
    handle: str(u.userName),
    displayName: str(u.name),
    bio: str(u.description),
    followersCount: int(u.followers),
    followingCount: int(u.following),
    tweetCount: int(u.statusesCount),
    verified: bool(u.isBlueVerified),
    createdAt: str(u.createdAt),
    avatarUrl: str(u.profilePicture),
  };
  const parsed = TwitterUserSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** Raw tweet object (tweets[]) -> Tweet. */
export function normalizeTweet(raw: unknown): Tweet | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Raw;
  const author = (t.author ?? {}) as Raw;
  const candidate = {
    id: str(t.id),
    authorId: str(author.id),
    authorHandle: str(author.userName),
    text: typeof t.text === "string" ? t.text : undefined,
    createdAt: str(t.createdAt),
    likeCount: int(t.likeCount),
    retweetCount: int(t.retweetCount),
    replyCount: int(t.replyCount),
    quoteCount: int(t.quoteCount),
    viewCount: int(t.viewCount),
    isReply: bool(t.isReply),
    isQuote: t.quoted_tweet != null,
    lang: str(t.lang),
  };
  const parsed = TweetSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** A raw engaging account (user or tweet.author) -> EngagedAccountRaw. */
export function normalizeEngaged(
  rawUser: unknown,
  tweetId: string,
  source: EngagementSource
): EngagedAccountRaw | null {
  const user = normalizeUser(rawUser);
  if (!user) return null;
  const parsed = EngagedAccountRawSchema.safeParse({ user, tweetId, source });
  return parsed.success ? parsed.data : null;
}
