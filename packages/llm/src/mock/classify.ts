import type {
  AudienceAccount,
  AudienceBucket,
  AudienceDistribution,
  EngagedAccountRaw,
  KolContentClassification,
  OrgClassification,
  Tweet,
  TwitterUser,
} from "@kol-fit/shared";

import type { ClassifyOrgInput } from "../provider.js";

// Deterministic mock "reasoning". These rules are the mock's stand-in for what
// the real LLM does via prompts. They are classification (not scoring), pure,
// and depend only on the inputs — identical inputs give deep-equal outputs.

/** First-match keyword rules over a bio/handle -> audience bucket. */
export function classifyBucket(user: TwitterUser): AudienceBucket {
  const bio = (user.bio ?? "").toLowerCase();
  const handle = user.handle.toLowerCase();
  const emptyBio = bio.trim().length === 0;
  const text = `${handle} ${bio}`;

  const has = (re: RegExp) => re.test(text);

  if (
    emptyBio ||
    /^(user|cryptonews|crypto_news|news)\d+/.test(handle) ||
    /giveaway|dm me to claim|send .* get|claim 🎁/.test(bio)
  ) {
    return "bots_spam";
  }
  if (has(/\bfounder\b|cofounder|co-founder/)) return "founders";
  if (has(/solidity|protocol engineer|\bdev\b|building on|zk|rust|smart contract/)) {
    return "developers";
  }
  if (has(/investor|\bangel\b|\bfund\b|investing in|\bvc\b/)) return "investors_vcs";
  if (has(/airdrop|points\.|quests|galxe|layer3|farming/)) return "airdrop_farmers";
  if (has(/wen moon|memecoin|meme coin|supercycle|wagmi|maxi|\$[a-z]{2,}/)) {
    return "meme_degens";
  }
  if (has(/\blp\b|liquidity provider|yield|delta-neutral|stablecoin|lending|vault|curve/)) {
    return "defi_users";
  }
  if (has(/perps|trader|funding-rate|funding rate|leverage|swing/)) return "traders";
  return "non_crypto";
}

function accountSignals(
  user: TwitterUser,
  bucket: AudienceBucket
): AudienceAccount["signals"] {
  const bio = user.bio ?? "";
  const emptyBio = bio.trim().length === 0;
  const farmingSignals: string[] = [];
  if (/airdrop/i.test(bio)) farmingSignals.push("airdrop");
  if (/points|quests|galxe|layer3/i.test(bio)) farmingSignals.push("points");
  const botScore =
    bucket === "bots_spam" ? 0.9 : (user.followersCount ?? 0) < 50 ? 0.5 : 0.1;
  return { botScore, emptyBio, farmingSignals };
}

/** One engaged account -> a classified AudienceAccount. */
export function toAudienceAccount(engager: EngagedAccountRaw): AudienceAccount {
  const bucket = classifyBucket(engager.user);
  return {
    handle: engager.user.handle,
    accountId: engager.user.id,
    source: engager.source,
    bucket,
    signals: accountSignals(engager.user, bucket),
  };
}

/** Per-bucket distribution (counts + shares) over classified accounts. */
export function buildDistribution(
  accounts: AudienceAccount[]
): AudienceDistribution {
  const sampleSize = accounts.length;
  const counts = new Map<AudienceBucket, number>();
  for (const a of accounts) counts.set(a.bucket, (counts.get(a.bucket) ?? 0) + 1);

  const buckets: AudienceDistribution["buckets"] = {};
  for (const [bucket, count] of counts) {
    buckets[bucket] = {
      count,
      share: sampleSize === 0 ? 0 : count / sampleSize,
    };
  }
  return { sampleSize, buckets };
}

// --- KOL content extraction (deterministic keyword/ticker scan over posts) ---

const THEME_RULES: { re: RegExp; theme: string; vertical: string }[] = [
  { re: /perp|funding|leverage|trading|liquidity/i, theme: "trading & market structure", vertical: "trading" },
  { re: /yield|lp|defi|stablecoin|lending/i, theme: "defi", vertical: "defi" },
  { re: /airdrop|farm|points/i, theme: "airdrops & incentives", vertical: "incentives" },
  { re: /audience|engaged|listen|impressions/i, theme: "audience quality", vertical: "growth" },
  { re: /ship|product|build|dev/i, theme: "product & building", vertical: "infra" },
];

export function extractKolContent(
  posts: Tweet[],
  replies: Tweet[] = []
): KolContentClassification {
  const corpus = [...posts, ...replies].map((t) => t.text).join(" \n ");
  const themes: string[] = [];
  const verticals: string[] = [];
  for (const rule of THEME_RULES) {
    if (rule.re.test(corpus)) {
      if (!themes.includes(rule.theme)) themes.push(rule.theme);
      if (!verticals.includes(rule.vertical)) verticals.push(rule.vertical);
    }
  }

  const tickers = Array.from(
    new Set((corpus.match(/\$[A-Z]{2,6}/g) ?? []).map((t) => t.toUpperCase()))
  ).sort();

  const promoPatterns: string[] = [];
  if (/giveaway|wen token|dm me|claim/i.test(corpus)) {
    promoPatterns.push("giveaway/promo language");
  }
  if (tickers.length >= 3) promoPatterns.push("frequent ticker mentions");

  return {
    themes,
    verticals,
    style: "analytical, thread-heavy",
    depth: themes.length >= 3 ? "high" : "medium",
    promoPatterns,
    repeatedTickers: tickers,
  };
}

// --- Org classification (respects manual brief; infers the rest) ---

function inferCategory(bio: string): string {
  const b = bio.toLowerCase();
  if (/perp|derivativ|trading/.test(b)) return "DeFi / perps";
  if (/lend|borrow|yield|stablecoin/.test(b)) return "DeFi / lending";
  if (/\bl2\b|rollup|settlement|infra/.test(b)) return "Infrastructure / L2";
  if (/wallet/.test(b)) return "Wallet";
  return "Crypto product";
}

function extractKeywords(bio: string): string[] {
  return Array.from(
    new Set(
      bio
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
    )
  )
    .sort()
    .slice(0, 6);
}

export function inferOrgClassification(
  input: ClassifyOrgInput
): OrgClassification {
  const brief = input.manualBrief ?? {};
  const bio = input.profile?.bio ?? "";
  return {
    // Manual brief fields OVERRIDE inferred fields (Invariant 7).
    productCategory: brief.productCategory ?? inferCategory(bio),
    targetUser: brief.targetUser ?? "Crypto-native users, traders, and builders",
    stage: brief.stage ?? "growth",
    campaignGoal: brief.campaignGoal ?? "awareness",
    region: brief.region ?? "Global / English",
    keywords: extractKeywords(bio),
    confidence: input.profile ? "medium" : "low",
  };
}
