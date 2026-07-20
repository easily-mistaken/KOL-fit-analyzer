import { z } from "zod";

// Shared-only vocabularies (not Prisma enums). Stored as JSON / free text, so
// this package owns their canonical machine values (lowercase snake_case) and
// human display labels.

/*
 * The engaged-audience taxonomy (Unit 43). Three ORTHOGONAL axes.
 *
 * The previous 15-value `AudienceBucket` list was a flat projection of all
 * three at once, which cost real information: `airdrop_farmers` erased whatever
 * the account actually was, `defi_users` fused a role with a domain, and
 * `non_crypto` was defined by NEGATION — it said what an account was not, which
 * is a dead end for any reader and an inverted one for a brand that is not
 * itself crypto (there, the residual is the whole market). Splitting the axes
 * dissolves all three problems: "non-crypto" stops existing as a category and
 * simply becomes a domain that is not one of the crypto ones.
 *
 * Every axis is a FIXED enum. The audience classification cache is keyed on
 * accounts + model and nothing about the requesting brand (see architecture.md)
 * so one creator's audience is classified once and reused by every brand;
 * a brand-specific vocabulary would void that. Brand-relative judgement belongs
 * on the org classification (`targetRoles` / `targetDomains`) instead.
 */

// AXIS 1 — ROLE: what this account DOES. Domain-independent by construction: a
// developer is a developer whether they build DeFi protocols or AI tooling.
export const AudienceRoleSchema = z.enum([
  "founder",
  "developer",
  "investor",
  "trader",
  "researcher",
  "creator",
  "operator",
  "enthusiast",
  "unknown",
]);
export type AudienceRole = z.infer<typeof AudienceRoleSchema>;

export const AUDIENCE_ROLE_LABELS: Record<AudienceRole, string> = {
  founder: "Founders",
  developer: "Developers",
  investor: "Investors",
  trader: "Traders",
  researcher: "Researchers",
  creator: "Creators",
  operator: "Community & ops",
  enthusiast: "Enthusiasts",
  unknown: "Unclear",
};

// AXIS 2 — DOMAIN: what SPACE this account is in. Crypto is four domains rather
// than one because the difference between a DeFi audience and a memecoin
// audience is the whole question for a crypto brand; everything else is a peer
// domain, not a residual.
export const AudienceDomainSchema = z.enum([
  "crypto_defi",
  "crypto_nft_gaming",
  "crypto_memecoins",
  "crypto_infra",
  "ai",
  "software",
  "finance",
  "creative",
  "gaming",
  "science",
  "culture",
  "news_politics",
  "general",
  "unknown",
]);
export type AudienceDomain = z.infer<typeof AudienceDomainSchema>;

export const AUDIENCE_DOMAIN_LABELS: Record<AudienceDomain, string> = {
  crypto_defi: "DeFi",
  crypto_nft_gaming: "NFT & on-chain gaming",
  crypto_memecoins: "Memecoins",
  crypto_infra: "Crypto infra",
  ai: "AI / ML",
  software: "Software & tech",
  finance: "Finance & business",
  creative: "Creative & media",
  gaming: "Gaming & esports",
  science: "Science & academia",
  culture: "Culture & lifestyle",
  news_politics: "News & politics",
  general: "General / no niche",
  unknown: "Unclear",
};

/** The crypto-native domains. A convenience for copy and for brands that still
 *  want the one-number "how much of this is crypto at all?" read — NOT a
 *  privileged category: nothing in scoring branches on it. */
export const CRYPTO_DOMAINS: readonly AudienceDomain[] = [
  "crypto_defi",
  "crypto_nft_gaming",
  "crypto_memecoins",
  "crypto_infra",
];

// AXIS 3 — QUALITY: is this real engagement? Its own axis because it is neither
// a role nor a domain, and because flattening it lost information that matters:
// a farming account that is genuinely a developer used to classify as
// `airdrop_farmers` and the role went with it. Now both are recorded, and
// scoring can discount the account without pretending it has no identity.
export const AudienceQualitySchema = z.enum([
  "real",
  "bot",
  "farmer",
  "giveaway_hunter",
]);
export type AudienceQuality = z.infer<typeof AudienceQualitySchema>;

export const AUDIENCE_QUALITY_LABELS: Record<AudienceQuality, string> = {
  real: "Real",
  bot: "Bots / spam",
  farmer: "Airdrop farmers",
  giveaway_hunter: "Giveaway hunters",
};

/** Quality values that are not a real human audience. Bots and giveaway
 *  hunters are excluded from the match denominator entirely; farmers are real
 *  people with distorted incentives, so they stay in the denominator and are
 *  discounted by the farmer weights in scoring instead. */
export const NON_HUMAN_QUALITY: readonly AudienceQuality[] = [
  "bot",
  "giveaway_hunter",
];

// Coarse macro-regions for audience geography (Unit 41 v3, Phase C). Country
// precision isn't reliably inferable from X profile `location` (free text,
// often blank/joke), so we work at a macro-region grain — enough to judge
// product-market fit (e.g. a stablecoin chain values high-inflation emerging
// markets; a capital-heavy trading app values higher-income regions). Any
// account we cannot place is `unknown` (not scored against, just uncounted).
export const AudienceRegionSchema = z.enum([
  "north_america",
  "latam",
  "western_europe",
  "eastern_europe",
  "mena", // Middle East & North Africa
  "subsaharan_africa",
  "south_asia", // India, Pakistan, Bangladesh, Sri Lanka, Nepal
  "southeast_asia", // Vietnam, Indonesia, Philippines, Thailand, ...
  "east_asia", // China, Korea, Japan, Taiwan, HK
  "cis", // Russia & Central Asia
  "oceania",
  "unknown",
]);
export type AudienceRegion = z.infer<typeof AudienceRegionSchema>;

export const AUDIENCE_REGION_LABELS: Record<AudienceRegion, string> = {
  north_america: "North America",
  latam: "Latin America",
  western_europe: "Western Europe",
  eastern_europe: "Eastern Europe",
  mena: "Middle East & N. Africa",
  subsaharan_africa: "Sub-Saharan Africa",
  south_asia: "South Asia",
  southeast_asia: "Southeast Asia",
  east_asia: "East Asia",
  cis: "Russia & Central Asia",
  oceania: "Oceania",
  unknown: "Unknown",
};

// Known campaign goals from project-overview.md. The request input accepts a
// free string; this enum is for later structured use.
export const CampaignGoalSchema = z.enum([
  "awareness",
  "community_growth",
  "user_acquisition",
  "developer_adoption",
  "token_launch_visibility",
  "investor_credibility",
]);
export type CampaignGoal = z.infer<typeof CampaignGoalSchema>;

export const CAMPAIGN_GOAL_LABELS: Record<CampaignGoal, string> = {
  awareness: "Awareness",
  community_growth: "Community growth",
  user_acquisition: "User acquisition",
  developer_adoption: "Developer adoption",
  token_launch_visibility: "Token launch visibility",
  investor_credibility: "Investor credibility",
};

// Canonical product stages. The request input accepts a free string; this enum
// is for later structured use.
export const ProductStageSchema = z.enum([
  "pre_launch",
  "testnet",
  "mainnet",
  "token_live",
  "growth",
]);
export type ProductStage = z.infer<typeof ProductStageSchema>;

export const PRODUCT_STAGE_LABELS: Record<ProductStage, string> = {
  pre_launch: "Pre-launch",
  testnet: "Testnet",
  mainnet: "Mainnet",
  token_live: "Token live",
  growth: "Growth",
};
