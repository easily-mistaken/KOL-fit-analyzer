import type { ScoreMetric } from "@kol-fit/shared";

// Plain-English explainers for the ⓘ affordance on each score metric (Unit 22).
// `what` = what the metric measures; `read` = how to read it / what to conclude.
// Client-facing copy: describes WHAT each metric tells the reader — never HOW
// it is computed (weights, baselines, thresholds, exclusions stay internal —
// Unit 33).
export type MetricInfo = { label: string; what: string; read: string };

export const METRIC_INFO: Record<ScoreMetric, MetricInfo> = {
  overall_fit: {
    label: "Overall fit",
    what: "The headline 0–100 fit score: how much of the creator's real, engaged audience is your target customer. This is the whole score — content, campaign, and geo signals are shown for context but do not change it.",
    read: "Higher means more of your target customer is actually in the room. A fake/farmed audience or a brand-safety problem can cap the verdict. The verdict badge is the plain-English version of this number.",
  },
  engaged_audience_match: {
    label: "Engaged audience match",
    what: "How much of the creator's genuinely engaged audience (the people who actually show up in their replies and conversations, not just follower counts) matches the users this brand wants to reach.",
    read: "This IS the fit score. Higher means your real target audience is actually in the room.",
  },
  audience_quality: {
    label: "Audience quality",
    what: "How real and valuable the engaged audience is: genuine, interested people versus bots, spam, and freebie-hunters.",
    read: "Higher = a cleaner audience than typical for the space. Lower means a meaningful slice of the engagement is noise.",
  },
  content_fit: {
    label: "Content fit",
    what: "How naturally this creator's world connects to yours, and whether their usual topics and their audience's interests make a mention of your product feel organic rather than forced.",
    read: "Context, not part of the score. Higher = the message lands in its natural habitat. What the creator posts is not who listens, so this informs your read rather than driving the number.",
  },
  campaign_goal_fit: {
    label: "Campaign goal fit",
    what: "How well this creator's audience serves your stated campaign goal: awareness, community growth, user acquisition, developer adoption, and so on.",
    read: "Context, not part of the score. The goal itself already reshapes who counts as your target in the fit score; this is shown for reference.",
  },
  brand_safety: {
    label: "Brand safety",
    what: "Whether anything in this creator's track record poses a reputational risk to your brand, from misleading claims to associations you wouldn't want next to your name.",
    read: "Higher = safer. Anything below a clean score deserves a human look before committing budget.",
  },
  geo_language_fit: {
    label: "Geo / language fit",
    what: "Whether this creator posts in the region and language your campaign targets.",
    read: "Context, not part of the score. Where the engaged audience actually is (and whether that fits your market) is shown separately as the audience-geography dial.",
  },
  paid_promo_risk: {
    label: "Paid-promo risk",
    what: "How much this creator's feed behaves like a paid billboard. Occasional relevant partnerships are normal; a feed dominated by unrelated promotions dilutes trust and endorsement value.",
    read: "Risk metric: higher is worse. High risk means their recommendation carries less weight with their audience.",
  },
  bot_farm_risk: {
    label: "Bot / farm risk",
    what: "How much of the visible engagement looks manufactured (automated accounts, engagement rings, or incentive-chasers) rather than real interest.",
    read: "Risk metric: higher is worse. When this is high, the reach numbers overstate the real audience.",
  },
};
