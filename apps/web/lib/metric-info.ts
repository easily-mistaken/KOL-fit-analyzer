import type { ScoreMetric } from "@kol-fit/shared";

// Plain-English explainers for the ⓘ affordance on each score metric (Unit 22).
// `what` = what the metric measures; `read` = how to read it / what to conclude.
// Client-facing copy — safe to edit freely.
export type MetricInfo = { label: string; what: string; read: string };

export const METRIC_INFO: Record<ScoreMetric, MetricInfo> = {
  overall_fit: {
    label: "Overall fit",
    what: "A single 0–100 blend of all nine signals into one score and verdict, weighting engaged-audience match the most.",
    read: "The headline call. 80+ strong, 65+ good, 50+ okay, 35+ weak, below that avoid.",
  },
  engaged_audience_match: {
    label: "Engaged audience match",
    what: "How much of the KOL's actually engaged audience — people who reply, quote and retweet, not just followers — overlaps with your target users.",
    read: "The most important metric. Higher means your real target is in the room, not just big follower counts.",
  },
  audience_quality: {
    label: "Audience quality",
    what: "How real and valuable the engaged audience is — genuine crypto-natives vs. bots, spam, and airdrop / giveaway farmers.",
    read: "Higher = a cleaner, more valuable audience. Low scores mean the engagement is padded.",
  },
  content_fit: {
    label: "Content fit",
    what: "How closely the KOL's topics and themes align with what your org actually does.",
    read: "Higher = they already talk about your space, so the message lands naturally.",
  },
  campaign_goal_fit: {
    label: "Campaign goal fit",
    what: "How suited this KOL is to your stated goal — awareness, community growth, user acquisition, developer adoption, and so on.",
    read: "Higher = a better tool for this campaign, even if the general fit differs.",
  },
  brand_safety: {
    label: "Brand safety",
    what: "How safe it is to associate your brand with this KOL — controversy, misleading claims and sketchy promotions.",
    read: "Higher = safer. Low scores are a reputational flag worth a manual look.",
  },
  geo_language_fit: {
    label: "Geo / language fit",
    what: "How well the audience's region and language match your target market.",
    read: "Higher = you're reaching the right geography, not just the right topic.",
  },
  paid_promo_risk: {
    label: "Paid-promo risk",
    what: "How much the KOL looks like a frequent paid shill, which dilutes trust and can inflate engagement.",
    read: "Risk metric — higher is worse. Discount their endorsement weight accordingly.",
  },
  bot_farm_risk: {
    label: "Bot / farm risk",
    what: "The share of engagement that looks automated or farmed rather than real people.",
    read: "Risk metric — higher is worse. Treat reach numbers with caution when this is high.",
  },
};
