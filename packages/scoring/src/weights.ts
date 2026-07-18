import type { AudienceBucket } from "@kol-fit/shared";

// Scoring v3 — "audience-honest" (Unit 41). The fit score IS the engaged-audience
// match; there are NO identity/relationship modifiers and NO weighted blend of
// other metrics. EVERY tunable lives here. See context/specs/41-scoring-v3-audience-honest.md.

// Verdict thresholds on the fit score (0-100 = engaged_audience_match),
// inclusive lower bounds. Chosen so the user's real-target-share bands land
// right through EAM_ANCHORS (0.45->88 STRONG, 0.30->75 GOOD, 0.15->55 OKAY,
// 0.05->30 WEAK, below -> AVOID).
export const VERDICT_THRESHOLDS = {
  STRONG: 85,
  GOOD: 70,
  OKAY: 50,
  WEAK: 30,
  // below WEAK -> AVOID
} as const;

// --- Calibration curves (piecewise-linear anchors, [x, score]) --------------
// Raw shares are NOT scores: real engaged audiences are heterogeneous, so a
// 30-40% target share is already strong. curve() interpolates between anchors.

export type CurveAnchors = ReadonlyArray<readonly [number, number]>;

/** Engaged-audience match: matched share of REAL (human) engaged accounts.
 *  This curve IS the fit score in v3. */
export const EAM_ANCHORS: CurveAnchors = [
  [0, 0],
  [0.05, 30],
  [0.15, 55],
  [0.3, 75],
  [0.45, 88],
  [0.6, 100],
];

/** Content fit: weighted 0-5 rubric average from the 29B assessment. 3/5
 *  ("clearly adjacent domains") ~= 70. Informational in v3 (not weighted). */
export const CF_ANCHORS: CurveAnchors = [
  [0, 10],
  [1, 30],
  [2, 50],
  [3, 70],
  [4, 85],
  [5, 96],
];

/** Paid-promo risk base: promo SATURATION (share of labeled posts that are
 *  promos). Occasional promos are the creator business model, not a risk. */
export const PROMO_ANCHORS: CurveAnchors = [
  [0, 0],
  [0.1, 10],
  [0.25, 35],
  [0.4, 60],
  [0.6, 85],
  [1, 100],
];

/** Bot/farm risk: EXCESS fake-engagement share above LOWQ_BASELINE. */
export const BOT_RISK_ANCHORS: CurveAnchors = [
  [0, 0],
  [0.1, 30],
  [0.2, 55],
  [0.35, 80],
  [0.5, 95],
  [1, 100],
];

/** Geo/language fit: share of KOL posts in the org's expected language(s).
 *  Informational in v3 (not weighted). */
export const GEO_ANCHORS: CurveAnchors = [
  [0, 30],
  [0.3, 60],
  [0.6, 85],
  [0.8, 95],
  [1, 100],
];

// --- Baselines / modifiers ---------------------------------------------------

/** Junk engagement (bots + giveaway + weighted farmers) below this share is
 *  "free" — it is endemic on crypto Twitter and shouldn't move scores. */
export const LOWQ_BASELINE = 0.1;

/** Audience-quality penalty slope per unit of junk share above the baseline. */
export const AQ_SLOPE = 180;

/** Max audience-quality bonus for repeat engagers (real community signal). */
export const REPEAT_ENGAGER_MAX_BONUS = 8;

/** Repeat-engager share at which the full bonus applies. */
export const REPEAT_ENGAGER_FULL_SHARE = 0.25;

/** Farmer shares count partially (humans, but low-value). */
export const FARMER_WEIGHT_QUALITY = 0.6; // in audience_quality lowQ
export const FARMER_WEIGHT_RISK = 0.5; // in bot_farm_risk fakeShare

/** Engagement-source weights for the audience match: a reply/quote is real
 *  attention; a retweet is cheap; a follow barely counts (kept small, not zero,
 *  per the v3 decision — a follow is a mild composition signal, not listening). */
export const SOURCE_WEIGHTS: Record<
  "REPLY" | "QUOTE" | "RETWEET" | "FOLLOWER",
  number
> = { REPLY: 1, QUOTE: 1, RETWEET: 0.5, FOLLOWER: 0.25 };

/** Secondary target buckets count at half weight. */
export const SECONDARY_TARGET_WEIGHT = 0.5;

/** When the brand's target can't be determined (org profile empty + no brief,
 *  or a sparse classification) scoring falls back to a generic "any real crypto
 *  audience" target. That measures crypto-ness, not confirmed brand fit — so the
 *  fit is capped here (max GOOD, never a confident STRONG) and forced to low
 *  confidence (Unit 41). One below the STRONG band. */
export const GENERIC_TARGET_MAX_FIT = VERDICT_THRESHOLDS.STRONG - 1;

/** Max soft tilt audience geography can apply to the fit (± fraction of the
 *  base match). Bounded because X location data is thin; scaled further by how
 *  much of the matched audience we could actually place (Unit 41 Phase C).
 *  Geography is part of "is this the right audience", so it moves the fit —
 *  softly. */
export const GEO_TILT_MAX = 0.15;

/** Paid-promo quality multiplier: related, decent promos run at the floor
 *  (normal business); unrelated/low-quality shills count fully. */
export const PROMO_QUALITY_FLOOR = 0.4;

/** Legacy paid-promo fallback (no 29B postLabels): pattern heuristic cap. */
export const PROMO_FALLBACK_CAP = 60;

// --- Verdict risk gates (v3: can only pull the verdict DOWN, never up) --------

/** Bot/farm risk at/above this caps the verdict at OKAY. */
export const BOT_GATE_OKAY = 85;
/** Bot/farm risk at/above this (majority-fake engagement) caps at WEAK. */
export const BOT_GATE_WEAK = 95;
/** Bot/farm risk at/above this (overwhelming fake/farmed engagement — raid
 *  rings, farm hubs, giveaway audiences; ~80%+ fake share) caps at AVOID. */
export const BOT_GATE_AVOID = 97;
/** Paid-promo gate: risk at/above these AND unrelatedShare above
 *  PROMO_GATE_UNRELATED_SHARE caps the verdict (OKAY / WEAK tiers). Promo
 *  saturation alone never reaches AVOID — promo-heavy accounts retain
 *  awareness value. */
export const PROMO_GATE_OKAY = 85;
export const PROMO_GATE_WEAK = 95;
export const PROMO_GATE_UNRELATED_SHARE = 0.5;
/** Brand-safety gates: confirmed severe safety findings cap the verdict
 *  regardless of fit — below WEAK-gate caps WEAK; below AVOID-gate (casino
 *  mismatch, deceptive claims, phishing, impersonation) caps AVOID. */
export const BRAND_GATE_WEAK = 40;
export const BRAND_GATE_AVOID = 20;

// --- Brand safety (29B flags; severity deductions, floor 0, no flags = 100) --

export const BRAND_SAFETY_DEDUCTIONS = { high: 35, medium: 15, low: 5 } as const;

// --- Content-fit rubric dimension weights (must sum to 1) --------------------

export const CF_RUBRIC_WEIGHTS = {
  topicalAdjacency: 0.3,
  audienceOverlapPotential: 0.4,
  naturalMentionFit: 0.3,
} as const;

// --- Campaign goal -> supporting audience buckets ----------------------------

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

// Buckets never counted as "target" audience.
export const NON_TARGET_BUCKETS: AudienceBucket[] = [
  "bots_spam",
  "giveaway_hunters",
];

// Buckets treated as "real crypto audience" for the generic fallback target set.
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

// Keyword -> target bucket hints. FALLBACK ONLY (29B org.targetBuckets is the
// primary source); scanned over productCategory/targetUser/keywords.
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

// --- Geo/language ------------------------------------------------------------

/** Region keyword -> expected post language codes (BCP-47 primary subtags). */
export const REGION_LANGS: { re: RegExp; langs: string[] }[] = [
  { re: /english|global|worldwide|us\b|usa|uk\b|europe/i, langs: ["en"] },
  { re: /korea/i, langs: ["ko", "en"] },
  { re: /japan/i, langs: ["ja", "en"] },
  { re: /china|chinese|taiwan|hong kong/i, langs: ["zh", "en"] },
  { re: /spanish|latam|latin america|mexico|argentina/i, langs: ["es", "en"] },
  { re: /brazil|portug/i, langs: ["pt", "en"] },
  { re: /france|french/i, langs: ["fr", "en"] },
  { re: /german/i, langs: ["de", "en"] },
  { re: /turk/i, langs: ["tr", "en"] },
  { re: /vietnam/i, langs: ["vi", "en"] },
  { re: /indonesia/i, langs: ["id", "en"] },
  { re: /india/i, langs: ["en", "hi"] },
  { re: /russia/i, langs: ["ru", "en"] },
];

/** Score when the org has no regional preference (global/unset). */
export const GEO_NEUTRAL_SCORE = 85;
