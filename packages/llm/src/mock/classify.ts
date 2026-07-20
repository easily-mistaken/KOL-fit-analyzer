import type {
  AudienceAccount,
  AudienceDistribution,
  AudienceDomain,
  AudienceQuality,
  AudienceRegion,
  AudienceRole,
  BrandSafetyFlag,
  ContentFitAssessment,
  EngagedAccountRaw,
  KolContentClassification,
  MediaLabel,
  OrgClassification,
  PostLabel,
  TargetDomains,
  TargetRoles,
  Tweet,
  TwitterUser,
} from "@kol-fit/shared";

import type { ClassifyOrgInput } from "../provider.js";

// Deterministic mock "reasoning". These rules are the mock's stand-in for what
// the real LLM does via prompts. They are classification (not scoring), pure,
// and depend only on the inputs — identical inputs give deep-equal outputs.

/*
 * Unit 43: the mock classifies on the same three orthogonal axes as the real
 * provider. Each axis is answered on its own — that independence is the whole
 * point of the split, and a mock that quietly re-fused them would hide exactly
 * the bugs these tests exist to catch (a farming developer must keep BOTH
 * facts, not collapse into one).
 */

/** Is this real engagement? Answered independently of role and domain. */
export function classifyQuality(user: TwitterUser): AudienceQuality {
  const bio = (user.bio ?? "").toLowerCase();
  const handle = user.handle.toLowerCase();
  if (
    bio.trim().length === 0 ||
    /^(user|cryptonews|crypto_news|news)\d+/.test(handle)
  ) {
    return "bot";
  }
  if (/giveaway|dm me to claim|send .* get|claim 🎁/.test(bio)) {
    return "giveaway_hunter";
  }
  if (/airdrop|points\.|quests|galxe|layer3|farming/.test(bio)) return "farmer";
  return "real";
}

/** What this account DOES — independent of the space they do it in. */
export function classifyRole(user: TwitterUser): AudienceRole {
  const text = `${user.handle.toLowerCase()} ${(user.bio ?? "").toLowerCase()}`;
  const has = (re: RegExp) => re.test(text);
  if (has(/\bfounder\b|cofounder|co-founder|\bceo\b/)) return "founder";
  if (has(/solidity|protocol engineer|\bdev\b|developer|engineer|building on|zk|rust|smart contract|programmer/)) {
    return "developer";
  }
  if (has(/investor|\bangel\b|\bfund\b|investing in|\bvc\b/)) return "investor";
  if (has(/perps|trader|trading|funding-rate|funding rate|leverage|swing/)) return "trader";
  if (has(/research|analyst|phd|professor|scientist|academic/)) return "researcher";
  if (has(/writer|creator|host|podcast|journalist|streamer|influencer|content/)) return "creator";
  if (has(/community|moderator|\bmod\b|marketing|growth|\bbd\b|ops\b/)) return "operator";
  // A readable bio with no professional signal is an ENTHUSIAST, not an
  // unknown: "arsenal fan | gym" tells us plenty. `unknown` is reserved for
  // genuinely nothing to go on, mirroring how classifyDomain separates
  // "general" from "unknown".
  return (user.bio ?? "").trim().length === 0 ? "unknown" : "enthusiast";
}

/** What SPACE this account is in. "Not crypto" is not an answer here — it is
 *  simply any of the non-crypto domains. */
export function classifyDomain(user: TwitterUser): AudienceDomain {
  const text = `${user.handle.toLowerCase()} ${(user.bio ?? "").toLowerCase()}`;
  const has = (re: RegExp) => re.test(text);
  if (has(/\blp\b|liquidity provider|yield|delta-neutral|stablecoin|lending|vault|curve|defi|perps|funding rate/)) {
    return "crypto_defi";
  }
  if (has(/\bnft\b|metaverse|pfp|opensea/)) return "crypto_nft_gaming";
  if (has(/wen moon|memecoin|meme coin|supercycle|wagmi|maxi|degen|\$[a-z]{2,}/)) {
    return "crypto_memecoins";
  }
  if (has(/solidity|protocol engineer|building on|zk|smart contract|rollup|validator|onchain|on-chain|airdrop|quests|galxe|layer3/)) {
    return "crypto_infra";
  }
  if (has(/\bai\b|\bml\b|machine learning|\bllm\b|neural|deep learning|data scien/)) return "ai";
  if (has(/software|saas|devops|frontend|backend|product manager|\bpm\b|typescript|python/)) {
    return "software";
  }
  if (has(/finance|fintech|banking|equities|economist|accountant|consultant|sales|marketing/)) {
    return "finance";
  }
  if (has(/designer|artist|writer|photograph|filmmaker|music|producer|illustrat/)) return "creative";
  if (has(/gamer|gaming|esports|twitch|streamer|speedrun/)) return "gaming";
  if (has(/phd|professor|researcher|scientist|university|lecturer|academic/)) return "science";
  if (has(/journalist|reporter|politic|news|correspondent|columnist/)) return "news_politics";
  if (has(/football|soccer|\bnba\b|fitness|gym|travel|food|chef|fashion|movie|anime/)) {
    return "culture";
  }
  if ((user.bio ?? "").trim().length === 0) return "unknown";
  return "general";
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
  quality: AudienceQuality
): AudienceAccount["signals"] {
  const bio = user.bio ?? "";
  const emptyBio = bio.trim().length === 0;
  const farmingSignals: string[] = [];
  if (/airdrop/i.test(bio)) farmingSignals.push("airdrop");
  if (/points|quests|galxe|layer3/i.test(bio)) farmingSignals.push("points");
  const botScore =
    quality === "bot" ? 0.9 : (user.followersCount ?? 0) < 50 ? 0.5 : 0.1;
  return { botScore, emptyBio, farmingSignals };
}

/** One engaged account -> a classified AudienceAccount. */
export function toAudienceAccount(engager: EngagedAccountRaw): AudienceAccount {
  const quality = classifyQuality(engager.user);
  const region = classifyRegion(engager.user);
  return {
    handle: engager.user.handle,
    accountId: engager.user.id,
    source: engager.source,
    role: classifyRole(engager.user),
    domain: classifyDomain(engager.user),
    quality,
    ...(region ? { region } : {}),
    signals: accountSignals(engager.user, quality),
  };
}

/** Distribution over classified accounts, on all three axes (Unit 43). Shares
 *  are over the same denominator on every axis — see the shared schema. */
export function buildDistribution(
  accounts: AudienceAccount[]
): AudienceDistribution {
  const sampleSize = accounts.length;
  const tally = <K extends string>(pick: (a: AudienceAccount) => K) => {
    const counts = new Map<K, number>();
    for (const a of accounts) {
      const k = pick(a);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const out: Partial<Record<K, { count: number; share: number }>> = {};
    for (const [k, count] of counts) {
      out[k] = { count, share: sampleSize === 0 ? 0 : count / sampleSize };
    }
    return out;
  };
  return {
    sampleSize,
    roles: tally((a) => a.role),
    domains: tally((a) => a.domain),
    quality: tally((a) => a.quality),
  };
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

/** Deterministic 0-5 rubric from token overlap (bounded, never a 0-100 score). */
export function assessContentFitMock(
  org: OrgClassification,
  content: KolContentClassification
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
    sharedTopics: shared,
    rationale:
      m > 0
        ? `Overlapping topics: ${shared.join(", ")}.`
        : cryptoKol
          ? "No direct topic overlap, but both operate in crypto."
          : "No meaningful topical relationship detected.",
  };
}

// --- Org targets (mock stand-in for the 29B LLM inference), two axes --------

const TARGET_ROLE_RULES: { re: RegExp; roles: AudienceRole[] }[] = [
  { re: /perp|derivativ|trading|trader/i, roles: ["trader"] },
  { re: /\bdev\b|sdk|api|infra|protocol|\bl2\b|rollup|settlement|tooling/i, roles: ["developer"] },
  { re: /founder|startup/i, roles: ["founder"] },
  { re: /investor|\bvc\b|fund/i, roles: ["investor"] },
  { re: /community|creator|influencer/i, roles: ["operator", "creator"] },
  { re: /consumer|retail|\bapp\b|wallet/i, roles: ["enthusiast"] },
];

const TARGET_DOMAIN_RULES: { re: RegExp; domains: AudienceDomain[] }[] = [
  { re: /defi|yield|lend|stablecoin|liquidity|amm|dex|perp/i, domains: ["crypto_defi"] },
  { re: /nft|metaverse/i, domains: ["crypto_nft_gaming"] },
  { re: /meme|degen/i, domains: ["crypto_memecoins"] },
  { re: /\bl2\b|rollup|protocol|infra|chain|\bzk\b|settlement/i, domains: ["crypto_infra"] },
  { re: /\bai\b|agent|machine learning|\bllm\b/i, domains: ["ai"] },
  { re: /\bsaas\b|software|devtool|developer tool|platform/i, domains: ["software"] },
  { re: /fintech|bank|payment|brokerage/i, domains: ["finance"] },
  { re: /gaming|game|esports/i, domains: ["gaming"] },
];

export function inferTargetRoles(org: {
  productCategory?: string;
  targetUser?: string;
  keywords?: string[];
}): TargetRoles {
  const text = [org.productCategory, org.targetUser, ...(org.keywords ?? [])]
    .filter(Boolean)
    .join(" ");
  const primary: AudienceRole[] = [];
  for (const rule of TARGET_ROLE_RULES) {
    if (rule.re.test(text)) {
      for (const r of rule.roles) if (!primary.includes(r)) primary.push(r);
    }
  }
  if (primary.length === 0) primary.push("developer", "enthusiast");
  const secondary: AudienceRole[] = (["founder", "investor"] as AudienceRole[]).filter(
    (r) => !primary.includes(r)
  );
  return { primary, secondary };
}

/** Domains have NO catch-all default: a brand we cannot read a space off of
 *  genuinely has no domain preference, and inventing one would fabricate the
 *  specificity the generic-target cap exists to admit is missing. */
export function inferTargetDomains(org: {
  productCategory?: string;
  targetUser?: string;
  keywords?: string[];
}): TargetDomains {
  const text = [org.productCategory, org.targetUser, ...(org.keywords ?? [])]
    .filter(Boolean)
    .join(" ");
  const primary: AudienceDomain[] = [];
  for (const rule of TARGET_DOMAIN_RULES) {
    if (rule.re.test(text)) {
      for (const d of rule.domains) if (!primary.includes(d)) primary.push(d);
    }
  }
  return { primary, secondary: [] };
}

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
    targetRoles: inferTargetRoles({ productCategory, targetUser, keywords }),
    targetDomains: inferTargetDomains({ productCategory, targetUser, keywords }),
    valuedRegions: inferValuedRegions({ productCategory, targetUser, keywords }),
    confidence: input.profile ? "medium" : "low",
  };
}
