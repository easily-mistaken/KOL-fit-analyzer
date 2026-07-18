import type {
  AudienceAccount,
  AudienceBucket,
  AudienceDistribution,
  AudienceRegion,
  BrandSafetyFlag,
  ContentFitAssessment,
  EngagedAccountRaw,
  KolContentClassification,
  MediaLabel,
  OrgClassification,
  PostLabel,
  TargetBuckets,
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

/** Coarse macro-region from the free-text profile location (mock stand-in for
 *  the LLM's region inference, Unit 41 Phase C). Unplaceable -> undefined
 *  (never penalized, just uncounted). The real, higher-recall inference over
 *  location + language + bio is the OpenAI provider (Phase C2). */
export function classifyRegion(user: TwitterUser): AudienceRegion | undefined {
  const loc = (user.location ?? "").toLowerCase().trim();
  if (loc.length === 0) return undefined;
  const has = (re: RegExp) => re.test(loc);
  if (has(/nigeria|lagos|kenya|nairobi|ghana|accra|africa|uganda|ethiopia/)) return "subsaharan_africa";
  if (has(/india|bangalore|bengaluru|mumbai|delhi|pakistan|bangladesh|sri lanka|nepal/)) return "south_asia";
  if (has(/vietnam|hanoi|indonesia|jakarta|philippines|manila|thailand|bangkok|malaysia|singapore/)) return "southeast_asia";
  if (has(/china|beijing|shanghai|korea|seoul|japan|tokyo|taiwan|taipei|hong kong/)) return "east_asia";
  if (has(/dubai|uae|abu dhabi|saudi|riyadh|qatar|egypt|cairo|turkey|istanbul|israel|tel aviv|morocco/)) return "mena";
  if (has(/brazil|sao paulo|são paulo|argentina|buenos aires|mexico|colombia|latam|latin america|chile|peru/)) return "latam";
  if (has(/russia|moscow|ukraine|kyiv|kazakhstan|belarus/)) return "cis";
  if (has(/australia|sydney|melbourne|new zealand|auckland/)) return "oceania";
  if (has(/poland|warsaw|romania|czech|prague|hungary|budapest|bulgaria|serbia|balkan/)) return "eastern_europe";
  if (has(/london|\buk\b|united kingdom|england|france|paris|germany|berlin|spain|madrid|italy|rome|netherlands|amsterdam|europe|portugal|lisbon|ireland|dublin|sweden|switzerland|zurich/)) return "western_europe";
  if (has(/\busa\b|united states|new york|\bnyc\b|san francisco|los angeles|miami|chicago|canada|toronto|austin|seattle|boston/)) return "north_america";
  return undefined;
}

/** Macro-regions where the product is economically relevant (mock stand-in,
 *  Unit 41 Phase C). Stablecoin/payments/savings -> high-inflation emerging
 *  markets; capital-heavy trading/derivatives/prediction -> higher-income
 *  regions; else no regional preference (a global audience serves it). */
export function inferValuedRegions(input: {
  productCategory?: string;
  targetUser?: string;
  keywords?: string[];
}): AudienceRegion[] | undefined {
  const text = [input.productCategory, input.targetUser, ...(input.keywords ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/stablecoin|payment|remittance|savings|inflation|off-ramp|on-ramp|neobank|dollar access|financial inclusion/.test(text)) {
    return ["subsaharan_africa", "latam", "south_asia", "southeast_asia", "mena"];
  }
  if (/perp|derivativ|leverage|prediction market|high-frequency|institutional|hedge fund/.test(text)) {
    return ["north_america", "western_europe", "east_asia"];
  }
  return undefined;
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
  const region = classifyRegion(engager.user);
  return {
    handle: engager.user.handle,
    accountId: engager.user.id,
    source: engager.source,
    bucket,
    ...(region ? { region } : {}),
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

// Per-post promo detection (mock stand-in for the 29B LLM post labels).
const PROMO_POST_RE = /giveaway|dm me|claim|sponsored|presale|wen token|🎁/i;

/** Deterministic per-post promo labels (Unit 29B). */
export function labelPosts(posts: Tweet[]): PostLabel[] {
  return posts.map((t) => {
    const isPromo = PROMO_POST_RE.test(t.text);
    return isPromo
      ? { postId: t.id, isPromo, promoRelated: true, promoQuality: "ok" as const }
      : { postId: t.id, isPromo };
  });
}

/** Deterministic brand-safety scan (Unit 29B); normally empty for fixtures. */
export function scanBrandSafety(corpus: string): BrandSafetyFlag[] {
  const flags: BrandSafetyFlag[] = [];
  if (/\brug(ged|pull)?\b|\bscam\b|\bponzi\b/i.test(corpus)) {
    flags.push({
      flag: "scam_or_rug_association",
      severity: "medium",
      evidence: "Posts reference rug/scam/ponzi language.",
    });
  }
  return flags;
}

/** Deterministic media labels from fixture URL hints (Unit 29B). */
export function labelMedia(posts: Tweet[]): MediaLabel[] {
  const labels: MediaLabel[] = [];
  for (const post of posts) {
    for (const m of post.media ?? []) {
      const url = (m.url ?? m.previewUrl ?? "").toLowerCase();
      const kind: MediaLabel["kind"] = /chart|dashboard|data|structure/.test(url)
        ? "chart_or_data"
        : /meme/.test(url)
          ? "meme"
          : /promo|banner/.test(url)
            ? "promo_graphic"
            : "photo_other";
      labels.push({ postId: post.id, kind });
    }
  }
  return labels;
}

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
    postLabels: labelPosts(posts),
    brandSafetyFlags: scanBrandSafety(corpus),
    mediaLabels: labelMedia(posts),
  };
}

// --- Content-fit rubric (mock stand-in for the 29B assessContentFit call) ---

function orgTerms(org: OrgClassification): Set<string> {
  return new Set(
    [org.productCategory, org.targetUser, ...(org.keywords ?? [])]
      .filter((s): s is string => Boolean(s))
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

/** Deterministic relationship classification from the KOL bio (Unit 29F mock
 *  stand-in): founder terms + org mention -> founder; founder terms alone ->
 *  adjacent; media/news terms -> media; analyst terms -> specialist. */
export function classifyRelationshipMock(
  orgHandle: string,
  profile: TwitterUser | null | undefined
): Pick<ContentFitAssessment, "relationship" | "relationshipEvidence"> {
  const bio = (profile?.bio ?? "").toLowerCase();
  if (bio.trim().length === 0) {
    return { relationship: "none", relationshipEvidence: "No profile bio available." };
  }
  const founderTerms = /founder|co-founder|cofounder|inventor|\bceo\b|core team|creator of/;
  const mentionsOrg = bio.includes(orgHandle.toLowerCase());
  if (founderTerms.test(bio) && mentionsOrg) {
    return {
      relationship: "founder_or_core_team",
      relationshipEvidence: `Bio claims a founder/core role at @${orgHandle}.`,
    };
  }
  if (/creator of \w+|ecosystem lead|head of protocol/.test(bio)) {
    return {
      relationship: "official_ecosystem_lead",
      relationshipEvidence: "Bio claims a creator/official-lead role for a platform.",
    };
  }
  if (founderTerms.test(bio)) {
    return {
      relationship: "adjacent_ecosystem_authority",
      relationshipEvidence: "Bio claims a founder/core role, but not at this org.",
    };
  }
  if (/\bnews\b|\bmedia\b|aggregator|daily updates/.test(bio)) {
    return { relationship: "media_or_news", relationshipEvidence: "Bio reads as a media/news account." };
  }
  if (/analyst|investigat|research/.test(bio)) {
    return {
      relationship: "independent_specialist",
      relationshipEvidence: "Bio reads as an independent analyst/investigator.",
    };
  }
  return { relationship: "none", relationshipEvidence: "No special relationship signals in the bio." };
}

/** Deterministic 0-5 rubric from token overlap (bounded, never a 0-100 score). */
export function assessContentFitMock(
  org: OrgClassification,
  content: KolContentClassification,
  orgHandle = "",
  profile?: TwitterUser | null
): ContentFitAssessment {
  const kolTerms = new Set<string>([
    ...content.verticals.map((v) => v.toLowerCase()),
    ...content.themes
      .join(" ")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2),
  ]);
  const shared = [...orgTerms(org)].filter((t) => kolTerms.has(t)).sort();
  const m = shared.length;
  const cryptoKol = content.verticals.length > 0;
  const adjacency = m >= 3 ? 5 : m === 2 ? 4 : m === 1 ? 3 : cryptoKol ? 2 : 0;
  return {
    topicalAdjacency: adjacency,
    audienceOverlapPotential: Math.min(5, adjacency + (cryptoKol ? 1 : 0)),
    naturalMentionFit: adjacency,
    // Unit 30 mock heuristic: direct topical overlap implies audience intent;
    // crypto-adjacent-without-overlap is plausible-but-unproven (3).
    audienceIntentOverlap: m >= 2 ? Math.min(5, adjacency + 1) : cryptoKol ? 3 : 1,
    sharedTopics: shared,
    rationale:
      m > 0
        ? `Overlapping topics: ${shared.join(", ")}.`
        : cryptoKol
          ? "No direct topic overlap, but both operate in crypto."
          : "No meaningful topical relationship detected.",
    ...classifyRelationshipMock(orgHandle, profile),
  };
}

// --- Org target buckets (mock stand-in for the 29B LLM inference) -----------

const TARGET_RULES: { re: RegExp; buckets: AudienceBucket[] }[] = [
  { re: /perp|derivativ|trading|trader/i, buckets: ["traders"] },
  { re: /defi|yield|lend|stablecoin|liquidity|amm|dex/i, buckets: ["defi_users"] },
  { re: /\bdev\b|sdk|api|infra|protocol|\bl2\b|rollup|settlement/i, buckets: ["developers", "infra_research"] },
  { re: /nft|gaming/i, buckets: ["nft_gaming"] },
  { re: /\bai\b|agent/i, buckets: ["ai_crypto"] },
];

export function inferTargetBuckets(org: {
  productCategory?: string;
  targetUser?: string;
  keywords?: string[];
}): TargetBuckets {
  const text = [org.productCategory, org.targetUser, ...(org.keywords ?? [])]
    .filter(Boolean)
    .join(" ");
  const primary: AudienceBucket[] = [];
  for (const rule of TARGET_RULES) {
    if (rule.re.test(text)) {
      for (const b of rule.buckets) if (!primary.includes(b)) primary.push(b);
    }
  }
  if (primary.length === 0) primary.push("defi_users", "traders");
  const secondary: AudienceBucket[] = ["founders", "investors_vcs"].filter(
    (b) => !primary.includes(b as AudienceBucket)
  ) as AudienceBucket[];
  return { primary, secondary };
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
  // Manual brief fields OVERRIDE inferred fields (Invariant 7).
  const productCategory = brief.productCategory ?? inferCategory(bio);
  const targetUser =
    brief.targetUser ?? "Crypto-native users, traders, and builders";
  const keywords = extractKeywords(bio);
  return {
    productCategory,
    targetUser,
    stage: brief.stage ?? "growth",
    campaignGoal: brief.campaignGoal ?? "awareness",
    region: brief.region ?? "Global / English",
    keywords,
    targetBuckets: inferTargetBuckets({ productCategory, targetUser, keywords }),
    valuedRegions: inferValuedRegions({ productCategory, targetUser, keywords }),
    confidence: input.profile ? "medium" : "low",
  };
}
