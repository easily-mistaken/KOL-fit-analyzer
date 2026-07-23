import {
  EngagedAccountRawSchema,
  TweetSchema,
  TwitterUserSchema,
  type EngagedAccountRaw,
  type EngagementSource,
  type Tweet,
  type TweetMedia,
  type TwitterUser,
} from "@kol-fit/shared";

// Raw TwitterAPI.io payloads are untyped; access defensively and coerce.
type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// Bound + sanitize engagement text (reply/quote bodies). Slicing can split an
// emoji (a surrogate pair); lone surrogates are invalid UTF-8 and are rejected
// by both Postgres jsonb and the OpenAI API, so strip them after slicing.
const ENGAGEMENT_TEXT_MAX = 500;

function stripLoneSurrogates(s: string): string {
  return s.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ""
  );
}

function sanitizeEngagementText(v: unknown): string | undefined {
  const t = str(v)?.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return stripLoneSurrogates(t.slice(0, ENGAGEMENT_TEXT_MAX));
}

const MEDIA_TYPES = new Set<TweetMedia["type"]>([
  "photo",
  "video",
  "animated_gif",
]);

/** extendedEntities.media (fallback entities.media) -> compact TweetMedia[].
 *  For photos media_url_https IS the image; for video/gif it is the thumbnail
 *  (v1.1 semantics), kept as previewUrl. Invalid items are skipped. */
function normalizeMedia(t: Raw): TweetMedia[] | undefined {
  const entities = t.extendedEntities ?? t.entities;
  if (!entities || typeof entities !== "object") return undefined;
  const list = (entities as Raw).media;
  if (!Array.isArray(list)) return undefined;
  const out: TweetMedia[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const m = item as Raw;
    const type = str(m.type) as TweetMedia["type"] | undefined;
    if (!type || !MEDIA_TYPES.has(type)) continue;
    const mediaUrl = str(m.media_url_https);
    out.push(
      type === "photo"
        ? { type, url: mediaUrl }
        : { type, previewUrl: mediaUrl }
    );
  }
  return out.length > 0 ? out : undefined;
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
    location: str(u.location),
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
    // A native repost carries the ORIGINAL tweet's engagement counts, so it
    // must be identifiable downstream (Unit 48). Belt-and-braces: the API's
    // retweeted_tweet field, plus the canonical "RT @" text prefix.
    isRetweet:
      t.retweeted_tweet != null ||
      (typeof t.text === "string" && t.text.startsWith("RT @")),
    lang: str(t.lang),
    media: normalizeMedia(t),
  };
  const parsed = TweetSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** A raw engaging account (user or tweet.author) -> EngagedAccountRaw. `text`
 *  is the engagement body (reply/quote tweet text) when one exists. */
export function normalizeEngaged(
  rawUser: unknown,
  tweetId: string,
  source: EngagementSource,
  text?: unknown
): EngagedAccountRaw | null {
  const user = normalizeUser(rawUser);
  if (!user) return null;
  const parsed = EngagedAccountRawSchema.safeParse({
    user,
    tweetId,
    source,
    text: sanitizeEngagementText(text),
  });
  return parsed.success ? parsed.data : null;
}
