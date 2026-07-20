import { z } from "zod";

// Shared-only vocabularies (not Prisma enums). Stored as JSON / free text, so
// this package owns their canonical machine values (lowercase snake_case) and
// human display labels.

// The 15 engaged-audience buckets from project-overview.md.
export const AudienceBucketSchema = z.enum([
  "founders",
  "developers",
  "defi_users",
  "traders",
  "investors_vcs",
  "airdrop_farmers",
  "meme_degens",
  "nft_gaming",
  "ai_crypto",
  "infra_research",
  "community_managers",
  "kols_creators",
  "bots_spam",
  "giveaway_hunters",
  "non_crypto",
]);
export type AudienceBucket = z.infer<typeof AudienceBucketSchema>;

export const AUDIENCE_BUCKET_LABELS: Record<AudienceBucket, string> = {
  founders: "Founders",
  developers: "Developers",
  defi_users: "DeFi users",
  traders: "Traders",
  investors_vcs: "Investors / VCs",
  airdrop_farmers: "Airdrop farmers",
  meme_degens: "Meme coin degens",
  nft_gaming: "NFT / gaming users",
  ai_crypto: "AI x crypto",
  infra_research: "Infra / research",
  community_managers: "Community managers",
  kols_creators: "Creators",
  bots_spam: "Bots / spam",
  giveaway_hunters: "Giveaway hunters",
  non_crypto: "Outside crypto",
};

// The SECOND axis, added because `non_crypto` is the one bucket in the list
// above defined by negation — it says what someone is NOT. That reads fine for
// a crypto brand (the residual genuinely is "outside my market", one number)
// but inverts for everyone else: for an AI or consumer brand that residual IS
// the addressable market, and "42% non-crypto" answers nothing.
//
// So accounts landing in `non_crypto` get a coarse domain telling you what they
// ARE. Deliberately a FIXED enum, not a per-brand vocabulary: the audience
// classification cache is keyed on accounts + model only (see llm-cache.ts), so
// one creator's audience is classified once and reused by every brand that
// analyses them. A brand-specific vocabulary would kill that reuse and make the
// most expensive LLM step re-run per brand. Brand-awareness lives instead in
// the cheap org classification (`OrgClassification.cryptoNative`), which only
// decides how these are PRESENTED.
export const AudienceDomainSchema = z.enum([
  "ai_ml",
  "software_tech",
  "finance_business",
  "creative_media",
  "gaming_esports",
  "science_academia",
  "culture_lifestyle",
  "news_politics",
  "general_consumer",
  "unknown",
]);
export type AudienceDomain = z.infer<typeof AudienceDomainSchema>;

export const AUDIENCE_DOMAIN_LABELS: Record<AudienceDomain, string> = {
  ai_ml: "AI / ML",
  software_tech: "Software & tech",
  finance_business: "Finance & business",
  creative_media: "Creative & media",
  gaming_esports: "Gaming & esports",
  science_academia: "Science & academia",
  culture_lifestyle: "Culture & lifestyle",
  news_politics: "News & politics",
  general_consumer: "General consumer",
  unknown: "Unclear",
};

/**
 * Buckets that only mean something inside crypto. For a non-crypto brand these
 * are the noise, so the chart folds them into one labelled slice instead of
 * spending its whole 6-slice budget on them.
 *
 * The rest of the taxonomy (founders, developers, investors_vcs,
 * community_managers, kols_creators) is ROLE, not domain — a developer in a
 * crypto creator's audience is still a developer, and an AI devtools brand has
 * every reason to want that number. Those stay visible for both brand kinds.
 * `airdrop_farmers` is crypto-specific too but is already claimed by the
 * low-quality fold, which outranks this one.
 */
export const CRYPTO_SPECIFIC_BUCKETS: readonly AudienceBucket[] = [
  "defi_users",
  "traders",
  "meme_degens",
  "nft_gaming",
  "ai_crypto",
  "infra_research",
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
