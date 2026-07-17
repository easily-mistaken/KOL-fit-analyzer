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
