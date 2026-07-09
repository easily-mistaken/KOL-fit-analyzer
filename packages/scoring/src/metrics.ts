import type {
  AudienceAccount,
  AudienceBucket,
  AudienceDistribution,
  ConfidenceLevel,
  KolContentClassification,
  OrgClassification,
  ScoreValue,
} from "@kol-fit/shared";

import { minConfidence } from "./confidence.js";
import type { ScoringBrief } from "./types.js";
import {
  CONTENT_FIT_CAP,
  GENERIC_TARGET_BUCKETS,
  GOAL_BUCKETS,
  KEYWORD_BUCKETS,
} from "./weights.js";

// --- shared helpers -------------------------------------------------------

export function clampRound(x: number): number {
  return Math.max(0, Math.min(100, Math.round(x)));
}

const pct = (share: number): string => `${Math.round(share * 100)}%`;

export function share(dist: AudienceDistribution, bucket: AudienceBucket): number {
  return dist.buckets[bucket]?.share ?? 0;
}

export function avgBotScore(accounts: AudienceAccount[]): number {
  if (accounts.length === 0) return 0;
  const total = accounts.reduce((s, a) => s + (a.signals.botScore ?? 0), 0);
  return total / accounts.length;
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

// --- target buckets (drives engaged_audience_match + campaign_goal_fit) ----

export function resolveGoal(
  org: OrgClassification,
  brief: ScoringBrief
): string | undefined {
  const raw = (brief.campaignGoal || org.campaignGoal || "").toLowerCase().trim();
  return raw.length > 0 ? raw : undefined;
}

export function deriveTargetBuckets(
  org: OrgClassification,
  brief: ScoringBrief,
  goal: string | undefined
): AudienceBucket[] {
  const set = new Set<AudienceBucket>();
  if (goal && GOAL_BUCKETS[goal]) {
    for (const b of GOAL_BUCKETS[goal]) set.add(b);
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
    if (re.test(text)) for (const b of buckets) set.add(b);
  }
  if (set.size === 0) for (const b of GENERIC_TARGET_BUCKETS) set.add(b);
  return [...set];
}

// --- metrics --------------------------------------------------------------

export function engagedAudienceMatch(
  dist: AudienceDistribution,
  targetBuckets: AudienceBucket[],
  sampleLevel: ConfidenceLevel
): ScoreValue {
  if (dist.sampleSize === 0) {
    return sv(0, "low", ["No engaged accounts were sampled."]);
  }
  const matched = targetBuckets.reduce((s, b) => s + share(dist, b), 0);
  return sv(clampRound(100 * matched), audienceConfidence(dist, sampleLevel), [
    `${pct(matched)} of engaged audience in target buckets: ${targetBuckets.join(", ")}`,
  ]);
}

export function audienceQuality(
  dist: AudienceDistribution,
  avgBot: number,
  sampleLevel: ConfidenceLevel
): ScoreValue {
  if (dist.sampleSize === 0) {
    return sv(0, "low", ["No engaged accounts were sampled."]);
  }
  const bots = share(dist, "bots_spam");
  const giveaway = share(dist, "giveaway_hunters");
  const farmers = share(dist, "airdrop_farmers");
  const penalty = 100 * bots + 100 * giveaway + 60 * farmers + 20 * avgBot;
  const reasons: string[] = [];
  if (bots > 0) reasons.push(`${pct(bots)} bots/spam`);
  if (giveaway > 0) reasons.push(`${pct(giveaway)} giveaway hunters`);
  if (farmers > 0) reasons.push(`${pct(farmers)} airdrop farmers`);
  if (avgBot > 0) reasons.push(`avg bot signal ${avgBot.toFixed(2)}`);
  reasons.push(
    reasons.length > 0
      ? "Low-quality accounts reduce audience quality."
      : "Audience appears largely genuine."
  );
  return sv(clampRound(100 - penalty), audienceConfidence(dist, sampleLevel), reasons);
}

export function contentFit(
  content: KolContentClassification,
  org: OrgClassification,
  brief: ScoringBrief,
  sampleLevel: ConfidenceLevel
): ScoreValue {
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
  const value = Math.min(CONTENT_FIT_CAP, clampRound((100 * matched.length) / denom));

  const empty = content.themes.length === 0 && content.verticals.length === 0;
  const reasons =
    matched.length > 0
      ? [`KOL content overlaps org domain on: ${matched.join(", ")}`]
      : ["Little topical overlap between KOL content and org domain."];
  return sv(value, empty ? "low" : minConfidence(sampleLevel, "medium"), reasons);
}

export function campaignGoalFit(
  dist: AudienceDistribution,
  goal: string | undefined,
  eamValue: number,
  sampleLevel: ConfidenceLevel
): ScoreValue {
  if (goal && GOAL_BUCKETS[goal]) {
    const buckets = GOAL_BUCKETS[goal];
    const supported = buckets.reduce((s, b) => s + share(dist, b), 0);
    return sv(clampRound(100 * supported), audienceConfidence(dist, sampleLevel), [
      `Goal "${goal}" supported by ${pct(supported)} of audience (${buckets.join(", ")})`,
    ]);
  }
  return sv(eamValue, audienceConfidence(dist, sampleLevel), [
    "Campaign goal unspecified; using engaged-audience-match as a proxy.",
  ]);
}

export function geoLanguageFit(region: string | null | undefined): ScoreValue {
  const r = (region ?? "").toLowerCase();
  if (r.length === 0 || /global|english|worldwide/.test(r)) {
    return sv(80, "low", [
      "Global/English default assumed; limited geo/language signal in mock data.",
    ]);
  }
  return sv(70, "low", [
    `Region "${region}" assumed English-language; limited geo/language signal in mock data.`,
  ]);
}

export function brandSafety(
  dist: AudienceDistribution,
  paidPromoRisk: number
): ScoreValue {
  const memeShare = share(dist, "meme_degens");
  const memePenalty = memeShare > 0.4 ? 15 : 0;
  const penalty = 0.7 * paidPromoRisk + memePenalty;
  const reasons: string[] = [];
  if (paidPromoRisk > 0) reasons.push(`paid-promo risk ${paidPromoRisk} lowers brand safety`);
  if (memePenalty > 0) reasons.push(`${pct(memeShare)} meme-degen audience`);
  if (reasons.length === 0) reasons.push("No significant brand-safety concerns detected.");
  return sv(clampRound(100 - penalty), "medium", reasons);
}

export function paidPromoRisk(
  content: KolContentClassification,
  sampleLevel: ConfidenceLevel
): ScoreValue {
  const promoCount = content.promoPatterns.length;
  const tickerCount = content.repeatedTickers.length;
  const risk = clampRound(15 * promoCount + (tickerCount >= 3 ? 20 : 0));
  const reasons: string[] = [];
  if (promoCount > 0) reasons.push(`${promoCount} promo pattern(s): ${content.promoPatterns.join("; ")}`);
  if (tickerCount >= 3) reasons.push(`frequent ticker mentions (${tickerCount})`);
  if (reasons.length === 0) reasons.push("No notable paid-promo patterns in sampled content.");
  reasons.push("Higher = more paid-promo risk.");
  const empty = content.themes.length === 0 && promoCount === 0;
  return sv(risk, empty ? "low" : minConfidence(sampleLevel, "medium"), reasons);
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
  const risk = clampRound(100 * bots + 100 * giveaway + 70 * farmers + 30 * avgBot);
  const reasons: string[] = [];
  if (bots > 0) reasons.push(`${pct(bots)} bots/spam`);
  if (giveaway > 0) reasons.push(`${pct(giveaway)} giveaway hunters`);
  if (farmers > 0) reasons.push(`${pct(farmers)} airdrop farmers`);
  if (avgBot > 0) reasons.push(`avg bot signal ${avgBot.toFixed(2)}`);
  if (reasons.length === 0) reasons.push("No strong bot/farm signals in the sampled audience.");
  reasons.push("Higher = more bot/farm risk.");
  return sv(risk, audienceConfidence(dist, sampleLevel), reasons);
}
