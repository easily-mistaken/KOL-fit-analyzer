import type { AudienceDomain, AudienceRole } from "@kol-fit/shared";

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

/**
 * Engaged-audience match: matched share of REAL (human) engaged accounts.
 * This curve IS the fit score.
 *
 * RECALIBRATED in Unit 43 (x-values only; the score anchors are untouched).
 * Two-axis matching awards PARTIAL credit — a right-role/wrong-domain account
 * contributes DOMAIN_FLOOR instead of a flat zero — so the same audience now
 * produces a structurally higher matched share than the old single-axis match
 * did. Left alone, every verdict would have drifted upward for free and the
 * bands would have stopped meaning what they say.
 *
 * The x-values are therefore scaled by ~1.10, the inflation measured on the
 * saved 2026-07-10 Uniswap benchmark (0.47 single-axis -> 0.52 two-axis under
 * ROLE_DOMAIN_FLOOR). That audience scored ~90 before and scores ~89 after: the
 * bands keep their meaning, and only the arithmetic feeding them changed.
 */
export const EAM_ANCHORS: CurveAnchors = [
  [0, 0],
  [0.055, 30],
  [0.165, 55],
  [0.33, 75],
  [0.5, 88],
  [0.66, 100],
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

// --- Activity + originality multipliers (Unit 48, down-only) -----------------
// A brand buys FUTURE posts from the creator's OWN voice. Both factors multiply
// the overall fit (never a component), are 1.0 in the healthy range, and only
// ever pull DOWN. Curves use the same piecewise-linear interpolation as the
// score anchors; x beyond the last anchor clamps to the last multiplier.

/** Days since the creator's last ORIGINAL (non-repost) post -> fit multiplier.
 *  Within a week is fully active; a month silent costs a band; 90+ days
 *  dormant floors at 0.35 (a STRONG 88 becomes a WEAK ~31). */
export const ACTIVITY_ANCHORS: CurveAnchors = [
  [0, 1],
  [7, 1],
  [14, 0.92],
  [30, 0.75],
  [60, 0.5],
  [90, 0.35],
];

/** Share of the fetched timeline that is reposts (native retweets) -> fit
 *  multiplier. Some resharing is normal curation (free up to 20%); a mostly
 *  repost timeline has little owned voice to sell and floors at 0.35. */
export const ORIGINALITY_ANCHORS: CurveAnchors = [
  [0, 1],
  [0.2, 1],
  [0.4, 0.9],
  [0.6, 0.75],
  [0.8, 0.55],
  [1, 0.35],
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
/**
 * Farmers in the engaged-audience MATCH (Unit 43).
 *
 * Under the old flat taxonomy `airdrop_farmers` was its own bucket and simply
 * was not a target, so a farmer sat in the denominator contributing zero — an
 * implicit 100% discount nobody had to write down. Splitting quality out means
 * a farmer now keeps a real role and domain (which is the point), and would
 * otherwise count as a FULL match and quietly inflate every farm-heavy KOL.
 *
 * 0.5 restores the discount without the old all-or-nothing: they are real
 * people who might convert, at meaningfully lower intent.
 */
export const FARMER_WEIGHT_MATCH = 0.5;

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

/**
 * What a right-role / wrong-domain account is worth, 0..1 — PER ROLE (Unit 43).
 *
 * Domain modulates the match instead of gating it, but how much domain matters
 * depends entirely on the role, and a single flat floor got this badly wrong.
 * A developer is a transferable specialist: one building AI tooling is still a
 * plausible user of a developer product, whatever space they are in. An
 * ENTHUSIAST is the opposite — they are *defined* by what they are enthusiastic
 * about, so an enthusiast of the wrong thing is simply not your user. With one
 * flat floor, any brand targeting consumers scored every random member of the
 * public at floor value, which is how a casino audience of 70% general public
 * came out mid-band instead of AVOID.
 *
 * So: expertise-led roles keep meaningful cross-domain value, interest-led ones
 * keep little or none. Re-tune here, and bump SCORING_VERSION when you do.
 */
export const ROLE_DOMAIN_FLOOR: Record<AudienceRole, number> = {
  developer: 0.35,
  researcher: 0.35,
  founder: 0.3,
  investor: 0.3, // capital crosses domains more easily than taste does
  operator: 0.2,
  creator: 0.2,
  trader: 0.1,
  enthusiast: 0, // their domain IS their identity
  unknown: 0, // never a target anyway
};

// --- Campaign goal -> supporting audience ------------------------------------

// Unit 43: a goal implies a ROLE need, and sometimes nothing about domain at
// all. The old flat table conflated the two — `user_acquisition` listing
// "defi_users, traders, nft_gaming, ai_crypto" was really saying "any crypto
// end-user", i.e. a domain statement wearing a role's clothes. Split, each
// entry says exactly one thing.

export const GOAL_ROLES: Record<string, AudienceRole[]> = {
  developer_adoption: ["developer", "researcher"],
  investor_credibility: ["investor", "founder"],
  user_acquisition: ["enthusiast", "trader"],
  token_launch_visibility: ["trader", "creator"],
  community_growth: ["operator", "creator", "enthusiast"],
  awareness: [
    "founder",
    "developer",
    "investor",
    "trader",
    "researcher",
    "creator",
    "operator",
    "enthusiast",
  ],
};

/** Goals that also narrow the DOMAIN. Most do not: wanting developers says
 *  nothing about which space they build in — that comes from the brand. */
export const GOAL_DOMAINS: Record<string, AudienceDomain[]> = {
  token_launch_visibility: ["crypto_defi", "crypto_memecoins", "crypto_infra"],
};

// Roles never counted as a target audience. Quality is a separate axis now, so
// this list holds only genuine non-targets: an account we could not identify at
// all. Bots and giveaway hunters are excluded upstream by QUALITY, which is
// what stopped their exclusion from being a role statement.
export const NON_TARGET_ROLES: AudienceRole[] = ["unknown"];

// Fallback target set when the brand could not be classified at all. Roles
// only: guessing a domain for a brand we failed to read would invent the very
// specificity the generic-target cap exists to admit we lack.
export const GENERIC_TARGET_ROLES: AudienceRole[] = [
  "founder",
  "developer",
  "investor",
  "trader",
  "researcher",
  "creator",
  "operator",
  "enthusiast",
];

// Keyword -> target hints. FALLBACK ONLY (29B org.targetRoles/targetDomains is
// the primary source); scanned over productCategory/targetUser/keywords.
export const KEYWORD_ROLES: { re: RegExp; roles: AudienceRole[] }[] = [
  { re: /perp|derivativ|trading|trader|leverage|funding/i, roles: ["trader"] },
  { re: /developer|\bdev\b|sdk|api|smart contract|infra|protocol|tooling/i, roles: ["developer"] },
  { re: /research|analytic|data|academic/i, roles: ["researcher"] },
  { re: /founder|startup|builder/i, roles: ["founder"] },
  { re: /investor|\bvc\b|fund|angel/i, roles: ["investor"] },
  { re: /community|creator|kol|influencer/i, roles: ["operator", "creator"] },
  { re: /consumer|retail|\buser\b|\bapp\b/i, roles: ["enthusiast"] },
];

export const KEYWORD_DOMAINS: { re: RegExp; domains: AudienceDomain[] }[] = [
  { re: /defi|yield|lending|stablecoin|liquidity|vault|amm|dex/i, domains: ["crypto_defi"] },
  { re: /nft|metaverse/i, domains: ["crypto_nft_gaming"] },
  { re: /meme|degen/i, domains: ["crypto_memecoins"] },
  { re: /\bl1\b|\bl2\b|rollup|zk\b|validator|node|chain|protocol|smart contract/i, domains: ["crypto_infra"] },
  { re: /\bai\b|artificial intelligence|machine learning|\bllm\b|agent/i, domains: ["ai"] },
  { re: /\bsaas\b|developer tool|devtool|software|api|platform|productivity/i, domains: ["software"] },
  { re: /fintech|bank|payment|trading app|brokerage|invest/i, domains: ["finance"] },
  { re: /design|creative|content|video|music|art/i, domains: ["creative"] },
  { re: /game|gaming|esports/i, domains: ["gaming"] },
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
