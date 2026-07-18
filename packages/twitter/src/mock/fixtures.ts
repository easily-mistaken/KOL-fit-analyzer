import type { Tweet, TweetMedia, TwitterUser } from "@kol-fit/shared";

// Deterministic mock fixtures. No Math.random / Date.now anywhere — identical
// inputs always produce deep-equal outputs, so the Unit 13 pipeline gets stable
// data. All ids/timestamps are derived deterministically from the inputs.

/** FNV-1a string hash — stable, dependency-free. */
export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Fixed epoch for derived timestamps (ms). Each item offsets from here.
const BASE_TIME = Date.parse("2026-01-01T00:00:00.000Z");
const DAY = 86_400_000;

function isoAt(offsetDays: number): string {
  return new Date(BASE_TIME - offsetDays * DAY).toISOString();
}

/**
 * Engaged-account pool spanning audience-bucket signals. The bio/handle of each
 * account is the classification signal used later (Unit 11/13/17); since Unit
 * 29A each account also carries a deterministic `replyText` (the reply/quote
 * body a REPLY/QUOTE engagement surfaces — substantive for real users, junk
 * for bots/farmers) so engagement-quality analysis is testable offline. The
 * mock only produces the raw accounts, it does not classify them.
 * `bucketSignal` is documentation/testing metadata and is NOT part of the
 * returned TwitterUser.
 */
export type PoolAccount = {
  bucketSignal: string;
  replyText: string;
  user: TwitterUser;
};

export const ENGAGED_ACCOUNT_POOL: PoolAccount[] = [
  {
    bucketSignal: "developers",
    replyText:
      "read the contracts before replying — the batching design is genuinely clever. good thread.",
    user: {
      id: "mock:acct:1",
      handle: "0xbuildoor",
      displayName: "gm builder",
      bio: "solidity dev, building on L2. contracts > vibes.",
      followersCount: 3200,
      followingCount: 410,
      tweetCount: 8800,
      verified: false,
      createdAt: isoAt(1400),
      location: "Lagos, Nigeria 🇳🇬",
    },
  },
  {
    bucketSignal: "developers",
    replyText:
      "we integrated this last sprint. docs were rough but the sdk holds up under load.",
    user: {
      id: "mock:acct:2",
      handle: "rustacean_eth",
      displayName: "anna.rs",
      bio: "protocol engineer. zk, rust, and too much coffee.",
      followersCount: 5100,
      followingCount: 300,
      tweetCount: 4200,
      verified: false,
      createdAt: isoAt(1600),
      location: "Berlin, Germany",
    },
  },
  {
    bucketSignal: "founders",
    replyText:
      "this matches what we saw raising our seed — sharing with the team.",
    user: {
      id: "mock:acct:3",
      handle: "founder_jane",
      displayName: "Jane • building",
      bio: "founder @somechain, ex-YC. shipping onchain infra.",
      followersCount: 24000,
      followingCount: 900,
      tweetCount: 6100,
      verified: true,
      createdAt: isoAt(2000),
      location: "Bangalore, India",
    },
  },
  {
    bucketSignal: "founders",
    replyText: "strong take. we're building in exactly this direction.",
    user: {
      id: "mock:acct:4",
      handle: "0xceo",
      displayName: "M",
      bio: "cofounder, building the settlement layer for agents.",
      followersCount: 41000,
      followingCount: 640,
      tweetCount: 3300,
      verified: true,
      createdAt: isoAt(1900),
    },
  },
  {
    bucketSignal: "defi_users",
    replyText:
      "been LPing this pool for months, the fee tier math here checks out.",
    user: {
      id: "mock:acct:5",
      handle: "curve_lp_life",
      displayName: "LP maxi",
      bio: "LP on curve/uni, real yield only. impermanent loss survivor.",
      followersCount: 2100,
      followingCount: 720,
      tweetCount: 12400,
      verified: false,
      createdAt: isoAt(1200),
      location: "São Paulo, Brazil",
    },
  },
  {
    bucketSignal: "defi_users",
    replyText:
      "moved my stables after reading this. the delta-neutral leg is the underrated part.",
    user: {
      id: "mock:acct:6",
      handle: "stablefarmer",
      displayName: "stables only",
      bio: "delta-neutral. vaults, lending, and boring stablecoin yield.",
      followersCount: 1500,
      followingCount: 540,
      tweetCount: 7700,
      verified: false,
      createdAt: isoAt(1100),
      location: "Nairobi, Kenya",
    },
  },
  {
    bucketSignal: "traders",
    replyText:
      "funding flipped negative right as you posted this lol. good call on the basis trade.",
    user: {
      id: "mock:acct:7",
      handle: "perps_degen",
      displayName: "funding enjoyer",
      bio: "perps degen 📈 funding-rate enjoyer. leverage is a lifestyle.",
      followersCount: 9800,
      followingCount: 1200,
      tweetCount: 33000,
      verified: false,
      createdAt: isoAt(900),
      location: "London, UK",
    },
  },
  {
    bucketSignal: "traders",
    replyText: "chart agrees. watching the range high — liquidity is stacked there.",
    user: {
      id: "mock:acct:8",
      handle: "chart_wizard",
      displayName: "TA guy",
      bio: "swing trader. liquidity, order blocks, and copium.",
      followersCount: 15600,
      followingCount: 800,
      tweetCount: 21000,
      verified: false,
      createdAt: isoAt(1000),
      location: "Jakarta, Indonesia",
    },
  },
  {
    bucketSignal: "airdrop_farmers",
    replyText: "wen airdrop ser 🪂 already did all the quests",
    user: {
      id: "mock:acct:9",
      handle: "airdrop_hunter",
      displayName: "🪂 farmer",
      bio: "airdrop hunter 🪂 farming every testnet. 47 wallets and counting.",
      followersCount: 600,
      followingCount: 2900,
      tweetCount: 41000,
      verified: false,
      createdAt: isoAt(500),
    },
  },
  {
    bucketSignal: "airdrop_farmers",
    replyText: "done ✅ retweeted + joined. wallet in bio. next quest?",
    user: {
      id: "mock:acct:10",
      handle: "sybil_szn",
      displayName: "points enjoyer",
      bio: "points. quests. galxe. layer3. wen token.",
      followersCount: 320,
      followingCount: 3500,
      tweetCount: 28000,
      verified: false,
      createdAt: isoAt(400),
    },
  },
  {
    bucketSignal: "meme_degens",
    replyText: "🚀🚀🚀 wagmi",
    user: {
      id: "mock:acct:11",
      handle: "wenmoon_ser",
      displayName: "🚀🚀🚀",
      bio: "wen moon 🚀🚀 $PEPE maxi. probably nothing. gm.",
      followersCount: 780,
      followingCount: 1800,
      tweetCount: 52000,
      verified: false,
      createdAt: isoAt(300),
    },
  },
  {
    bucketSignal: "meme_degens",
    replyText: "ser this is the way 🐶 sending it",
    user: {
      id: "mock:acct:12",
      handle: "dogwifstuff",
      displayName: "ponke",
      bio: "memecoin supercycle. i buy the dog. wagmi frens 🐶",
      followersCount: 4200,
      followingCount: 2100,
      tweetCount: 39000,
      verified: false,
      createdAt: isoAt(250),
    },
  },
  {
    bucketSignal: "bots_spam",
    replyText: "Great project! 💯💯 Check my profile for FREE signals",
    user: {
      id: "mock:acct:13",
      handle: "user8372641",
      displayName: "User8372641",
      bio: "",
      followersCount: 3,
      followingCount: 41,
      tweetCount: 12,
      verified: false,
      createdAt: isoAt(20),
    },
  },
  {
    bucketSignal: "bots_spam",
    replyText: "🎁 GIVEAWAY!! DM me to claim — send 0.1 get 1 back!!",
    user: {
      id: "mock:acct:14",
      handle: "giveaway_x_free",
      displayName: "FREE GIVEAWAY 🎁",
      bio: "DM me to claim 🎁🎁 send 0.1 get 1 back!!",
      followersCount: 9,
      followingCount: 4900,
      tweetCount: 61000,
      verified: false,
      createdAt: isoAt(10),
    },
  },
  {
    bucketSignal: "bots_spam",
    replyText: "gm",
    user: {
      id: "mock:acct:15",
      handle: "cryptoNews4471",
      displayName: "crypto news",
      bio: "",
      followersCount: 1,
      followingCount: 12,
      tweetCount: 4,
      verified: false,
      createdAt: isoAt(5),
    },
  },
  {
    bucketSignal: "investors_vcs",
    replyText:
      "interesting — we've been tracking this vertical all year. dms open if you're raising.",
    user: {
      id: "mock:acct:16",
      handle: "seed_investor",
      displayName: "early @ fund",
      bio: "investing in early crypto infra. angel + fund. dms open.",
      followersCount: 52000,
      followingCount: 1100,
      tweetCount: 5400,
      verified: true,
      createdAt: isoAt(2200),
      location: "New York, USA",
    },
  },
];

/** Deterministic subset of the pool (full entries) for a seed (tweetId+source). */
export function selectPool(seed: string, limit: number): PoolAccount[] {
  const pool = ENGAGED_ACCOUNT_POOL;
  const count = Math.max(0, Math.min(limit, pool.length));
  const start = hashString(seed) % pool.length;
  const out: PoolAccount[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pool[(start + i) % pool.length]);
  }
  return out;
}

/** Deterministic subset of the account pool for a seed (users only). */
export function selectAccounts(seed: string, limit: number): TwitterUser[] {
  return selectPool(seed, limit).map((p) => p.user);
}

// Richer "known" profiles for a plausible org and KOL; any other handle gets a
// deterministic derived profile.
const KNOWN_PROFILES: Record<string, TwitterUser> = {
  acmeprotocol: {
    id: "mock:user:acmeprotocol",
    handle: "acmeprotocol",
    displayName: "Acme Protocol",
    bio: "Onchain perps for everyone. Trade with deep liquidity on L2. Backed by real users, not points.",
    followersCount: 88000,
    followingCount: 120,
    tweetCount: 2400,
    verified: true,
    createdAt: isoAt(1500),
  },
  cryptowhale: {
    id: "mock:user:cryptowhale",
    handle: "cryptowhale",
    displayName: "Crypto Whale 🐋",
    bio: "DeFi + trading takes. Threads on perps, market structure, and airdrops. Not financial advice.",
    followersCount: 210000,
    followingCount: 640,
    tweetCount: 48000,
    verified: true,
    createdAt: isoAt(2100),
  },
};

/** Deterministic profile for any handle (known handles get richer fixtures). */
export function makeProfile(handle: string): TwitterUser {
  const known = KNOWN_PROFILES[handle];
  if (known) return known;

  const h = hashString(handle);
  return {
    id: `mock:user:${handle}`,
    handle,
    displayName: `@${handle}`,
    bio: "Crypto account. Posts about onchain products, trading, and community.",
    followersCount: 1000 + (h % 90000),
    followingCount: 100 + (h % 1500),
    tweetCount: 500 + (h % 20000),
    verified: h % 5 === 0,
    createdAt: isoAt(300 + (h % 1500)),
  };
}

// Varied post templates so top-post-by-engagement selection is meaningful.
// Some carry deterministic media fixtures (Unit 29A): substantive charts on
// analysis posts, a meme image, one video — so media-aware classification
// (Unit 29B) is testable offline.
const POST_TEMPLATES: { text: string; engagement: number; media?: TweetMedia[] }[] = [
  {
    text: "Perps are eating spot. Here's why onchain order books win long term. 🧵",
    engagement: 100,
    media: [{ type: "photo", url: "https://mock.local/media/perps-orderbook-chart.png" }],
  },
  { text: "gm. audience quality > follower count. always has been.", engagement: 40 },
  {
    text: "New thread: how to tell real yield from farmed TVL. Bookmark this.",
    engagement: 90,
    media: [{ type: "photo", url: "https://mock.local/media/real-yield-dashboard.png" }],
  },
  { text: "Airdrop farmers are not your users. Change my mind.", engagement: 75 },
  {
    text: "The memecoin supercycle is a distraction from real product. Or is it?",
    engagement: 85,
    media: [{ type: "photo", url: "https://mock.local/media/supercycle-meme.jpg" }],
  },
  { text: "Shipping > shilling. Small update but a good one.", engagement: 20 },
  {
    text: "Market structure 101: liquidity, funding, and why your fills are bad.",
    engagement: 60,
    media: [{ type: "video", previewUrl: "https://mock.local/media/market-structure-thumb.jpg" }],
  },
  { text: "If your KOL's replies are all 🚀🚀🚀, that's a signal (a bad one).", engagement: 70 },
  { text: "Devs are the real leading indicator. Watch where they build.", engagement: 55 },
  { text: "Quick take on L2 fragmentation and what it means for users.", engagement: 45 },
  { text: "Stablecoin yield is boring and that's the point.", engagement: 15 },
  { text: "Wen product-market fit? When your engaged audience is your target user.", engagement: 65 },
];

/** Deterministic posts for a handle, newest-first. */
export function makeKolPosts(handle: string): Tweet[] {
  return POST_TEMPLATES.map((t, i) => {
    const base = t.engagement;
    return {
      id: `mock:tweet:${handle}:${i}`,
      authorId: `mock:user:${handle}`,
      authorHandle: handle,
      text: t.text,
      createdAt: isoAt(i * 2),
      likeCount: base * 12,
      retweetCount: base * 2,
      replyCount: base,
      quoteCount: Math.floor(base / 2),
      viewCount: base * 400,
      isReply: false,
      isQuote: false,
      lang: "en",
      ...(t.media ? { media: t.media } : {}),
    };
  });
}

const REPLY_TEMPLATES = [
  "great point, this matches what we're seeing onchain.",
  "disagree — follower count still matters for reach.",
  "bookmarking this, thread is 🔥",
  "source? curious where the funding data comes from.",
  "this is why we only look at engaged wallets, not impressions.",
  "wen token ser",
];

/** Deterministic replies authored by the KOL. */
export function makeKolReplies(handle: string): Tweet[] {
  return REPLY_TEMPLATES.map((text, i) => ({
    id: `mock:reply:${handle}:${i}`,
    authorId: `mock:user:${handle}`,
    authorHandle: handle,
    text,
    createdAt: isoAt(i * 3 + 1),
    likeCount: 5 + i * 3,
    retweetCount: i,
    replyCount: i % 2,
    quoteCount: 0,
    viewCount: 200 + i * 50,
    isReply: true,
    isQuote: false,
    lang: "en",
  }));
}

// Minimal deterministic search results (no discovery this unit).
export const SEARCH_RESULTS: Tweet[] = [
  {
    id: "mock:search:1",
    authorHandle: "cryptowhale",
    text: "Search is not discovery. This unit stays known-org + known-KOL.",
    createdAt: isoAt(3),
    likeCount: 120,
    retweetCount: 18,
    replyCount: 22,
    quoteCount: 6,
    lang: "en",
  },
  {
    id: "mock:search:2",
    authorHandle: "founder_jane",
    text: "Engaged audience match is the metric that matters.",
    createdAt: isoAt(4),
    likeCount: 240,
    retweetCount: 30,
    replyCount: 41,
    quoteCount: 9,
    lang: "en",
  },
];
