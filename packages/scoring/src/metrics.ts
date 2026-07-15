import type {
  AudienceAccount,
  AudienceBucket,
  AudienceDistribution,
  ConfidenceLevel,
  ContentFitAssessment,
  KolContentClassification,
  OrgClassification,
  ScoreValue,
} from "@kol-fit/shared";

import { minConfidence } from "./confidence.js";
import type { ScoringBrief } from "./types.js";
import {
  AQ_SLOPE,
  BOT_RISK_ANCHORS,
  BRAND_SAFETY_DEDUCTIONS,
  CF_ANCHORS,
  CF_RUBRIC_WEIGHTS,
  EAM_ANCHORS,
  FARMER_WEIGHT_QUALITY,
  FARMER_WEIGHT_RISK,
  GENERIC_TARGET_BUCKETS,
  GEO_ANCHORS,
  GEO_NEUTRAL_SCORE,
  GOAL_BUCKETS,
  INTENT_DAMP,
  INTENT_FLOOR,
  KEYWORD_BUCKETS,
  LOWQ_BASELINE,
  NON_TARGET_BUCKETS,
  PROMO_ANCHORS,
  PROMO_FALLBACK_CAP,
  PROMO_QUALITY_FLOOR,
  REGION_LANGS,
  REPEAT_ENGAGER_FULL_SHARE,
  REPEAT_ENGAGER_MAX_BONUS,
  SECONDARY_TARGET_WEIGHT,
  SOURCE_WEIGHTS,
  type CurveAnchors,
} from "./weights.js";

// --- shared helpers -------------------------------------------------------

export function clampRound(x: number): number {
  return Math.max(0, Math.min(100, Math.round(x)));
}

const pct = (share: number): string => `${Math.round(share * 100)}%`;

/** Piecewise-linear interpolation over [x, score] anchors (v2 calibration:
 *  raw shares are NOT scores). x is clamped to the anchor range. */
export function curve(x: number, anchors: CurveAnchors): number {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i];
    if (x <= x1) {
      const [x0, y0] = anchors[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  /* c8 ignore next */
  return last[1];
}

export function share(dist: AudienceDistribution, bucket: AudienceBucket): number {
  return dist.buckets[bucket]?.share ?? 0;
}

/** Average LLM bot signal over accounts that HAVE one — null/missing botScore
 *  is excluded, so sparse data no longer deflates measured risk (v2 fix). */
export function avgBotScore(accounts: AudienceAccount[]): number {
  let sum = 0;
  let n = 0;
  for (const a of accounts) {
    const s = a.signals.botScore;
    if (typeof s === "number") {
      sum += s;
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

const sv = (
  value: number,
  confidence: ConfidenceLevel,
  reasons: string[]
): ScoreValue => ({ value, confidence, reasons });

/** Sample-size-based confidence for audience metrics (low when nothing sampled). */
function audienceConfidence(
  dist: AudienceDistribution,
  sampleLevel: ConfidenceLevel
): ConfidenceLevel {
  return dist.sampleSize === 0 ? "low" : sampleLevel;
}

// --- target buckets ---------------------------------------------------------

const NON_TARGET = new Set<AudienceBucket>(NON_TARGET_BUCKETS);

export type TargetSets = {
  primary: Set<AudienceBucket>;
  secondary: Set<AudienceBucket>;
  /** Where the targets came from — surfaces in reasons. */
  source: "llm" | "keywords" | "generic";
};

export function resolveGoal(
  org: OrgClassification,
  brief: ScoringBrief
): string | undefined {
  const raw = (brief.campaignGoal || org.campaignGoal || "").toLowerCase().trim();
  return raw.length > 0 ? raw : undefined;
}

/** Fuzzy goal-string -> GOAL_BUCKETS key ("developer adoption" matches
 *  developer_adoption); undefined when nothing matches (v2 fix: LLM-inferred
 *  free-text goals no longer silently fall through). */
export function normalizeGoal(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const g = raw.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (GOAL_BUCKETS[g]) return g;
  return Object.keys(GOAL_BUCKETS).find((k) => g.includes(k) || k.includes(g));
}

/** Target audience: the 29B LLM-inferred org.targetBuckets when present
 *  (primary weight 1, secondary 0.5); legacy keyword/goal derivation as the
 *  fallback (all-primary). bots_spam/giveaway_hunters are never targets. */
export function resolveTargets(
  org: OrgClassification,
  brief: ScoringBrief,
  goalKey: string | undefined
): TargetSets {
  const tb = org.targetBuckets;
  if (tb && tb.primary.length > 0) {
    const primary = new Set(tb.primary.filter((b) => !NON_TARGET.has(b)));
    const secondary = new Set(
      tb.secondary.filter((b) => !NON_TARGET.has(b) && !primary.has(b))
    );
    return { primary, secondary, source: "llm" };
  }

  const primary = new Set<AudienceBucket>();
  if (goalKey && GOAL_BUCKETS[goalKey]) {
    for (const b of GOAL_BUCKETS[goalKey]) primary.add(b);
  }
  const text = [
    org.productCategory,
    org.targetUser,
    brief.productCategory,
    brief.targetUser,
    ...(org.keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  for (const { re, buckets } of KEYWORD_BUCKETS) {
    if (re.test(text)) for (const b of buckets) primary.add(b);
  }
  if (primary.size > 0) {
    return { primary, secondary: new Set(), source: "keywords" };
  }
  return {
    primary: new Set(GENERIC_TARGET_BUCKETS),
    secondary: new Set(),
    source: "generic",
  };
}

// --- human-weighted matching --------------------------------------------------

type MatchResult = { matchedShare: number; humanCount: number };

/** Matched share over HUMAN accounts only (bucket not bots_spam /
 *  giveaway_hunters — their harm lives in audience_quality/bot_farm_risk, so
 *  they no longer triple-punish), weighted by engagement source (reply/quote
 *  1.0, retweet 0.5) and target tier (primary 1.0, secondary 0.5). */
export function weightedMatch(
  accounts: AudienceAccount[],
  targets: Pick<TargetSets, "primary" | "secondary">
): MatchResult {
  let matched = 0;
  let total = 0;
  let humanCount = 0;
  for (const a of accounts) {
    if (NON_TARGET.has(a.bucket)) continue;
    const w = SOURCE_WEIGHTS[a.source] ?? 1;
    total += w;
    humanCount++;
    if (targets.primary.has(a.bucket)) matched += w;
    else if (targets.secondary.has(a.bucket)) {
      matched += w * SECONDARY_TARGET_WEIGHT;
    }
  }
  return { matchedShare: total > 0 ? matched / total : 0, humanCount };
}

// --- metrics --------------------------------------------------------------

export function engagedAudienceMatch(
  accounts: AudienceAccount[],
  dist: AudienceDistribution,
  targets: TargetSets,
  sampleLevel: ConfidenceLevel,
  intentOverlap?: number
): ScoreValue {
  if (dist.sampleSize === 0) {
    return sv(0, "low", ["No engaged accounts were sampled."]);
  }
  const { matchedShare, humanCount } = weightedMatch(accounts, targets);
  if (humanCount === 0) {
    return sv(0, audienceConfidence(dist, sampleLevel), [
      "No real (non-bot/giveaway) engaged accounts in the classified sample.",
    ]);
  }
  const sourceNote =
    targets.source === "llm"
      ? "org-inferred targets"
      : targets.source === "keywords"
        ? "keyword-derived targets"
        : "generic crypto-audience targets";
  const reasons = [
    `${pct(matchedShare)} of the real engaged audience (${humanCount} humans, reply/quote-weighted) matches ${sourceNote}: ` +
      `primary ${[...targets.primary].join(", ") || "(none)"}${targets.secondary.size > 0 ? `; secondary ${[...targets.secondary].join(", ")}` : ""}.`,
    "Calibrated: real engaged audiences are heterogeneous — 30% target share is strong, 45%+ exceptional.",
  ];

  // Intent adjustment (Unit 30, v26 rule 4): category match is damped on a
  // clear intent mismatch and floored on demonstrated intent.
  const base = curve(matchedShare, EAM_ANCHORS);
  const i = typeof intentOverlap === "number" ? intentOverlap : undefined;
  const damp = i !== undefined ? (INTENT_DAMP[i] ?? 1) : 1;
  const floor = i !== undefined ? (INTENT_FLOOR[i] ?? 0) : 0;
  let value = base * damp;
  if (damp < 1) {
    reasons.push(
      `Audience intent overlap ${i}/5 — the matched buckets share the org's CATEGORY but not its user intent; match damped accordingly.`
    );
  }
  if (floor > value) {
    value = floor;
    reasons.push(
      `Audience intent overlap ${i}/5 — the audience demonstrably seeks what this product offers; match floored despite weak bucket-category overlap.`
    );
  }
  return sv(clampRound(value), audienceConfidence(dist, sampleLevel), reasons);
}

export function audienceQuality(
  dist: AudienceDistribution,
  repeatEngagerShare: number,
  sampleLevel: ConfidenceLevel
): ScoreValue {
  if (dist.sampleSize === 0) {
    return sv(0, "low", ["No engaged accounts were sampled."]);
  }
  const bots = share(dist, "bots_spam");
  const giveaway = share(dist, "giveaway_hunters");
  const farmers = share(dist, "airdrop_farmers");
  const lowQ = bots + giveaway + FARMER_WEIGHT_QUALITY * farmers;
  const excess = Math.max(0, lowQ - LOWQ_BASELINE);
  const bonus = Math.round(
    REPEAT_ENGAGER_MAX_BONUS *
      Math.min(1, repeatEngagerShare / REPEAT_ENGAGER_FULL_SHARE)
  );
  const reasons: string[] = [];
  if (lowQ > 0) {
    reasons.push(
      `${pct(lowQ)} low-quality engagement (${pct(bots)} bots/spam, ${pct(giveaway)} giveaway hunters, ${pct(farmers)} airdrop farmers).`
    );
  }
  reasons.push(
    excess > 0
      ? `Penalized only above the ${pct(LOWQ_BASELINE)} baseline — junk engagement is endemic on crypto Twitter.`
      : `Within the ${pct(LOWQ_BASELINE)} junk baseline — no penalty.`
  );
  if (bonus > 0) {
    reasons.push(
      `${pct(repeatEngagerShare)} repeat engagers (engaged multiple analyzed posts) — real community signal (+${bonus}).`
    );
  }
  return sv(
    clampRound(100 - AQ_SLOPE * excess + bonus),
    audienceConfidence(dist, sampleLevel),
    reasons
  );
}

export function contentFit(
  assessment: ContentFitAssessment | undefined,
  content: KolContentClassification,
  org: OrgClassification,
  brief: ScoringBrief,
  sampleLevel: ConfidenceLevel
): ScoreValue {
  if (assessment) {
    const rubric =
      CF_RUBRIC_WEIGHTS.topicalAdjacency * assessment.topicalAdjacency +
      CF_RUBRIC_WEIGHTS.audienceOverlapPotential * assessment.audienceOverlapPotential +
      CF_RUBRIC_WEIGHTS.naturalMentionFit * assessment.naturalMentionFit;
    const reasons = [
      `Semantic rubric: adjacency ${assessment.topicalAdjacency}/5, audience overlap ${assessment.audienceOverlapPotential}/5, natural mention ${assessment.naturalMentionFit}/5.`,
    ];
    if (assessment.sharedTopics.length > 0) {
      reasons.push(`Shared topics: ${assessment.sharedTopics.join(", ")}.`);
    }
    if (assessment.rationale) reasons.push(assessment.rationale);
    return sv(
      clampRound(curve(rubric, CF_ANCHORS)),
      minConfidence(sampleLevel, "medium"),
      reasons
    );
  }

  // Legacy token-overlap fallback (assessment unavailable) — semantically
  // blind, so confidence is low.
  const kolTerms = new Set<string>([
    ...content.verticals.map((v) => v.toLowerCase()),
    ...tokenize(content.themes.join(" ")),
  ]);
  const orgTerms = new Set<string>([
    ...tokenize(
      [org.productCategory, org.targetUser, brief.productCategory]
        .filter(Boolean)
        .join(" ")
    ),
    ...(org.keywords ?? []).map((k) => k.toLowerCase()),
  ]);
  const matched: string[] = [];
  for (const t of orgTerms) if (kolTerms.has(t)) matched.push(t);
  const denom = Math.max(1, Math.min(orgTerms.size, 6));
  const value = clampRound((100 * matched.length) / denom);
  return sv(value, "low", [
    matched.length > 0
      ? `Token-overlap fallback (no semantic assessment): overlaps on ${matched.join(", ")}.`
      : "Token-overlap fallback (no semantic assessment): little direct topical overlap.",
  ]);
}

export function campaignGoalFit(
  accounts: AudienceAccount[],
  dist: AudienceDistribution,
  goalRaw: string | undefined,
  goalKey: string | undefined,
  targets: TargetSets,
  eamValue: number,
  sampleLevel: ConfidenceLevel
): ScoreValue {
  if (goalKey && GOAL_BUCKETS[goalKey]) {
    // Goal support = human-weighted coverage of union(goal buckets, primary
    // targets). Linear (a coverage ratio, not a rarity-adjusted match).
    const goalTargets = new Set<AudienceBucket>([
      ...GOAL_BUCKETS[goalKey],
      ...targets.primary,
    ]);
    const { matchedShare, humanCount } = weightedMatch(accounts, {
      primary: goalTargets,
      secondary: new Set(),
    });
    if (dist.sampleSize === 0 || humanCount === 0) {
      return sv(0, "low", ["No usable engaged accounts to assess goal support."]);
    }
    return sv(clampRound(100 * matchedShare), audienceConfidence(dist, sampleLevel), [
      `Goal "${goalKey}" supported by ${pct(matchedShare)} of the real engaged audience (${GOAL_BUCKETS[goalKey].join(", ")}).`,
    ]);
  }
  return sv(eamValue, audienceConfidence(dist, sampleLevel), [
    goalRaw
      ? `Campaign goal "${goalRaw}" not recognized; using engaged-audience-match as a proxy.`
      : "Campaign goal unspecified; using engaged-audience-match as a proxy.",
  ]);
}

/** Normalize Twitter lang codes to primary subtags; drop non-language codes. */
function normalizeLangs(langs: string[] | undefined): string[] {
  return (langs ?? [])
    .map((l) => l.toLowerCase().split("-")[0])
    .filter((l) => /^[a-z]{2,3}$/.test(l) && l !== "und" && l !== "zxx" && !l.startsWith("q"));
}

export function geoLanguageFit(
  region: string | null | undefined,
  kolPostLangs: string[] | undefined
): ScoreValue {
  const langs = normalizeLangs(kolPostLangs);
  const r = (region ?? "").trim();
  const neutral = r.length === 0 || /global|english|worldwide/i.test(r);

  if (neutral) {
    if (langs.length === 0) {
      return sv(80, "low", [
        "No regional preference and no post-language data; assuming global/English reach.",
      ]);
    }
    return sv(GEO_NEUTRAL_SCORE, "medium", [
      "No regional preference set; a global/English audience serves the campaign.",
    ]);
  }

  const mapping = REGION_LANGS.find(({ re }) => re.test(r));
  const expected = mapping?.langs ?? ["en"];
  if (langs.length === 0) {
    return sv(70, "low", [
      `Region "${r}" requested but no post-language data was available.`,
    ]);
  }
  const matchShare =
    langs.filter((l) => expected.includes(l)).length / langs.length;
  return sv(clampRound(curve(matchShare, GEO_ANCHORS)), "medium", [
    `${pct(matchShare)} of sampled posts are in the language(s) expected for "${r}" (${expected.join(", ")}).`,
    ...(mapping ? [] : [`Region "${r}" not in the language table; assumed English.`]),
  ]);
}

export function brandSafety(content: KolContentClassification): ScoreValue {
  const flags = content.brandSafetyFlags ?? [];
  if (flags.length === 0) {
    return sv(100, "medium", [
      "No brand-safety flags detected (scam/rug association, misleading claims, harassment, NSFW, drama, gambling, legal, impersonation).",
    ]);
  }
  let deduction = 0;
  const reasons: string[] = [];
  for (const f of flags) {
    deduction += BRAND_SAFETY_DEDUCTIONS[f.severity];
    reasons.push(`${f.flag} (${f.severity}): ${f.evidence}`);
  }
  return sv(clampRound(100 - deduction), "medium", reasons);
}

export type PromoRiskResult = {
  value: ScoreValue;
  /** Share of promo posts that are OUTSIDE the KOL's domain — feeds the
   *  verdict promo gate. */
  unrelatedShare: number;
};

export function paidPromoRisk(
  content: KolContentClassification,
  sampleLevel: ConfidenceLevel
): PromoRiskResult {
  const labels = content.postLabels;
  if (labels && labels.length > 0) {
    const promos = labels.filter((l) => l.isPromo);
    const saturation = promos.length / labels.length;
    const unrelatedShare =
      promos.length > 0
        ? promos.filter((l) => l.promoRelated === false).length / promos.length
        : 0;
    const lowQualityShare =
      promos.length > 0
        ? promos.filter((l) => l.promoQuality === "low").length / promos.length
        : 0;
    const quality = Math.max(unrelatedShare, lowQualityShare);
    const multiplier = PROMO_QUALITY_FLOOR + (1 - PROMO_QUALITY_FLOOR) * quality;
    const risk = clampRound(curve(saturation, PROMO_ANCHORS) * multiplier);
    const reasons: string[] = [
      `${promos.length}/${labels.length} labeled posts are promotional (${pct(saturation)} saturation).`,
    ];
    if (promos.length > 0) {
      reasons.push(
        `${pct(unrelatedShare)} of promos are outside the KOL's domain; ${pct(lowQualityShare)} promote low-quality projects.`,
        quality < 0.25
          ? "In-domain, decent-quality promotion is the KOL business model — risk discounted accordingly."
          : "Unrelated/low-quality promotion drives the risk up."
      );
    } else {
      reasons.push("No promotional posts in the labeled sample.");
    }
    reasons.push("Higher = more paid-promo risk.");
    return {
      value: sv(risk, minConfidence(sampleLevel, "medium"), reasons),
      unrelatedShare,
    };
  }

  // Legacy fallback (no 29B per-post labels): pattern-count heuristic, softened
  // and capped — pattern counts are uncalibrated, so confidence is low.
  const promoCount = content.promoPatterns.length;
  const tickerCount = content.repeatedTickers.length;
  const risk = Math.min(
    PROMO_FALLBACK_CAP,
    clampRound(10 * promoCount + (tickerCount >= 3 ? 15 : 0))
  );
  const reasons: string[] = [];
  if (promoCount > 0) reasons.push(`${promoCount} promo pattern(s): ${content.promoPatterns.join("; ")}`);
  if (tickerCount >= 3) reasons.push(`frequent ticker mentions (${tickerCount})`);
  if (reasons.length === 0) reasons.push("No notable paid-promo patterns in sampled content.");
  reasons.push("Legacy heuristic (no per-post labels available). Higher = more paid-promo risk.");
  return { value: sv(risk, "low", reasons), unrelatedShare: 0 };
}

export function botFarmRisk(
  dist: AudienceDistribution,
  avgBot: number,
  sampleLevel: ConfidenceLevel
): ScoreValue {
  if (dist.sampleSize === 0) {
    return sv(0, "low", [
      "No engaged accounts were sampled.",
      "Higher = more bot/farm risk.",
    ]);
  }
  const bots = share(dist, "bots_spam");
  const giveaway = share(dist, "giveaway_hunters");
  const farmers = share(dist, "airdrop_farmers");
  const fakeShare = bots + giveaway + FARMER_WEIGHT_RISK * farmers;
  const excess = Math.max(0, fakeShare - LOWQ_BASELINE);
  const botNudge = Math.round(20 * Math.max(0, avgBot - 0.4));
  const risk = clampRound(curve(excess, BOT_RISK_ANCHORS) + botNudge);
  const reasons: string[] = [
    `${pct(fakeShare)} fake-leaning engagement (${pct(bots)} bots/spam, ${pct(giveaway)} giveaway hunters, ${pct(farmers)} airdrop farmers).`,
    excess > 0
      ? `Scored on the ${pct(excess)} EXCESS above the ${pct(LOWQ_BASELINE)} baseline — some bot presence is unavoidable.`
      : `Within the ${pct(LOWQ_BASELINE)} baseline — no meaningful bot/farm risk.`,
  ];
  if (botNudge > 0) reasons.push(`Elevated average bot signal (${avgBot.toFixed(2)}) adds +${botNudge}.`);
  reasons.push("Higher = more bot/farm risk.");
  return sv(risk, audienceConfidence(dist, sampleLevel), reasons);
}
