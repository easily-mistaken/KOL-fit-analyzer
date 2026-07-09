import type { AudienceBucket, ScoreMetric } from "@kol-fit/shared";

// Locked overall weights (sum = 1.00). Weights live in packages/scoring, not in
// @kol-fit/shared. engaged_audience_match dominates (the product's core metric);
// content_fit is deliberately minor. The two risk metrics are NOT direct terms
// here — they act through audience_quality / brand_safety and the verdict risk
// gate.
export const OVERALL_WEIGHTS = {
  engaged_audience_match: 0.35,
  audience_quality: 0.2,
  content_fit: 0.15,
  campaign_goal_fit: 0.15,
  brand_safety: 0.1,
  geo_language_fit: 0.05,
} as const satisfies Partial<Record<ScoreMetric, number>>;

// Verdict thresholds on overall_fit (0-100), inclusive lower bounds.
export const VERDICT_THRESHOLDS = {
  STRONG: 80,
  GOOD: 65,
  OKAY: 50,
  WEAK: 35,
  // below WEAK -> AVOID
} as const;

// Risk gate: if either risk >= this, the verdict is capped at WEAK.
export const RISK_GATE_THRESHOLD = 70;

// content_fit is capped so strong topical overlap alone can't produce a top score.
export const CONTENT_FIT_CAP = 90;

// Campaign goal -> supporting audience buckets.
export const GOAL_BUCKETS: Record<string, AudienceBucket[]> = {
  developer_adoption: ["developers", "infra_research"],
  investor_credibility: ["investors_vcs", "founders"],
  user_acquisition: ["defi_users", "traders", "nft_gaming", "ai_crypto"],
  token_launch_visibility: ["traders", "meme_degens", "kols_creators"],
  community_growth: [
    "community_managers",
    "kols_creators",
    "developers",
    "defi_users",
  ],
  awareness: [
    "founders",
    "developers",
    "defi_users",
    "traders",
    "investors_vcs",
    "nft_gaming",
    "ai_crypto",
    "infra_research",
    "community_managers",
    "kols_creators",
  ],
};

// Buckets treated as "real crypto audience" for the generic fallback target set
// (everything except low-quality / off-target buckets).
export const GENERIC_TARGET_BUCKETS: AudienceBucket[] = [
  "founders",
  "developers",
  "defi_users",
  "traders",
  "investors_vcs",
  "nft_gaming",
  "ai_crypto",
  "infra_research",
  "community_managers",
  "kols_creators",
  "meme_degens",
];

// Keyword -> target bucket hints, scanned over productCategory/targetUser/keywords.
export const KEYWORD_BUCKETS: { re: RegExp; buckets: AudienceBucket[] }[] = [
  { re: /perp|derivativ|trading|trader|leverage|funding/i, buckets: ["traders"] },
  { re: /defi|yield|lending|stablecoin|liquidity|vault|amm|dex/i, buckets: ["defi_users"] },
  { re: /developer|\bdev\b|sdk|api|smart contract|infra|protocol|tooling/i, buckets: ["developers", "infra_research"] },
  { re: /nft|gaming|game|metaverse/i, buckets: ["nft_gaming"] },
  { re: /\bai\b|agent|machine learning/i, buckets: ["ai_crypto"] },
  { re: /founder|startup|builder/i, buckets: ["founders"] },
  { re: /investor|\bvc\b|fund|angel/i, buckets: ["investors_vcs"] },
  { re: /meme|degen/i, buckets: ["meme_degens"] },
  { re: /community|creator|kol/i, buckets: ["community_managers", "kols_creators"] },
];
