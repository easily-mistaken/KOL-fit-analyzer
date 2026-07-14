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
    what: "How much of the KOL's REAL engaged audience — humans who reply and quote (weighted above retweets), with bots and giveaway accounts excluded — matches your target users. Calibrated: real audiences are mixed, so ~30% target share already scores strong.",
    read: "The most important metric. Higher means your actual target is in the room, not just big follower counts.",
  },
  audience_quality: {
    label: "Audience quality",
    what: "How clean the engaged audience is. A ~10% baseline of bots/farmers is expected on crypto Twitter and costs nothing; only junk above that baseline is penalized. Repeat engagers (real community) earn a bonus.",
    read: "Higher = cleaner than typical. Low scores mean the engagement is padded well beyond the normal noise floor.",
  },
  content_fit: {
    label: "Content fit",
    what: "A semantic judgment of how naturally this KOL's content connects to your org — topical adjacency, audience-overlap plausibility, and whether a mention would feel organic. Adjacent domains count, not just identical keywords.",
    read: "Higher = they already talk to your world, so the message lands naturally.",
  },
  campaign_goal_fit: {
    label: "Campaign goal fit",
    what: "How suited this KOL is to your stated goal — awareness, community growth, user acquisition, developer adoption, and so on.",
    read: "Higher = a better tool for this campaign, even if the general fit differs.",
  },
  brand_safety: {
    label: "Brand safety",
    what: "Concrete safety flags found in the content — scam/rug association, misleading claims, harassment, NSFW, excessive drama, gambling, legal issues, impersonation — each weighted by severity. No flags = 100. Ordinary promotion and memes are NOT penalized here.",
    read: "Higher = safer. Anything below 100 lists the specific flags and evidence — worth a manual look.",
  },
  geo_language_fit: {
    label: "Geo / language fit",
    what: "Whether the KOL actually posts in the language(s) your target region speaks, measured from their post languages. No regional preference = a neutral score.",
    read: "Higher = you're reaching the right geography, not just the right topic.",
  },
  paid_promo_risk: {
    label: "Paid-promo risk",
    what: "How SATURATED the feed is with promotion, scaled by promo quality: occasional in-domain promos are the normal KOL business model and score low; a feed dominated by unrelated or low-quality shills scores high.",
    read: "Risk metric — higher is worse. Promo presence alone isn't disqualifying; unrelated shilling at scale is.",
  },
  bot_farm_risk: {
    label: "Bot / farm risk",
    what: "Fake-looking engagement (bots, giveaway hunters, farm accounts) ABOVE the ~10% noise floor that's normal on crypto Twitter. Only clearly excessive fake share caps the verdict.",
    read: "Risk metric — higher is worse. Treat reach numbers with caution when this is high.",
  },
};
