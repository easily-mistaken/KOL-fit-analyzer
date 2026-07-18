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
  non_crypto: "Non-crypto audience",
};

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
