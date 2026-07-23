import type {
  AudienceAccount,
  AudienceDistribution,
  AudienceDomain,
  AudienceQuality,
  AudienceRegion,
  AudienceRole,
  ConfidenceLevel,
  ContentFitAssessment,
  ExpectedReach,
  KolContentClassification,
  OrgClassification,
  RegionDistribution,
  ScoreValue,
} from "@kol-fit/shared";
import { NON_HUMAN_QUALITY } from "@kol-fit/shared";

import { minConfidence } from "./confidence.js";
import type { ScoringBrief } from "./types.js";
import {
  ACTIVITY_ANCHORS,
  AQ_SLOPE,
  BOT_RISK_ANCHORS,
  BRAND_SAFETY_DEDUCTIONS,
  CF_ANCHORS,
  CF_RUBRIC_WEIGHTS,
  EAM_ANCHORS,
  ORIGINALITY_ANCHORS,
  ORIGINALITY_CADENCE_RELIEF_PER_WEEK,
  FARMER_WEIGHT_MATCH,
  FARMER_WEIGHT_QUALITY,
  FARMER_WEIGHT_RISK,
  GENERIC_TARGET_ROLES,
  GENERIC_TARGET_MAX_FIT,
  GEO_ANCHORS,
  GEO_TILT_MAX,
  GEO_NEUTRAL_SCORE,
  ROLE_DOMAIN_FLOOR,
  GOAL_DOMAINS,
  GOAL_ROLES,
  KEYWORD_DOMAINS,
  KEYWORD_ROLES,
  LOWQ_BASELINE,
  NON_TARGET_ROLES,
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

/** Share of the classified sample sitting at one value of the quality axis. */
export function qualityShare(
  dist: AudienceDistribution,
  quality: AudienceQuality
): number {
  // Defensive `?? {}`: the schema makes every axis required, so a validated
  // distribution always has all three — but scoring is also called with
  // hand-built objects (tests, future callers), and a missing axis should read
  // as "no such accounts", never crash a whole analysis.
  return (dist.quality ?? {})[quality]?.share ?? 0;
}

/** Share of the classified sample sitting at one domain. */
export function domainShare(
  dist: AudienceDistribution,
  domain: AudienceDomain
): number {
  return (dist.domains ?? {})[domain]?.share ?? 0;
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

// --- targets ----------------------------------------------------------------

const NON_TARGET_ROLE = new Set<AudienceRole>(NON_TARGET_ROLES);
const NON_HUMAN = new Set<AudienceQuality>(NON_HUMAN_QUALITY);

/** Bots and giveaway hunters are not a human audience and leave the match
 *  denominator entirely. Farmers stay: they are real people with distorted
 *  incentives, and their harm is already priced by the farmer weights in
 *  audience_quality / bot_farm_risk — dropping them here too would punish the
 *  same signal three times over. */
const isHuman = (a: AudienceAccount): boolean => !NON_HUMAN.has(a.quality);

export type TargetTier<T> = { primary: Set<T>; secondary: Set<T> };

export type TargetSets = {
  roles: TargetTier<AudienceRole>;
  /** Empty means the brand has NO domain preference — treated as neutral (every
   *  domain fully satisfies it), not as "nothing matches". A global devtool
   *  genuinely does not care which space its developers work in. */
  domains: TargetTier<AudienceDomain>;
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

/** Fuzzy goal-string -> GOAL_ROLES key ("developer adoption" matches
 *  developer_adoption); undefined when nothing matches (v2 fix: LLM-inferred
 *  free-text goals no longer silently fall through). */
export function normalizeGoal(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const g = raw.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (GOAL_ROLES[g]) return g;
  return Object.keys(GOAL_ROLES).find((k) => g.includes(k) || k.includes(g));
}

/**
 * Target audience on BOTH axes (Unit 43): the LLM-inferred `org.targetRoles` /
 * `org.targetDomains` when present, with keyword and goal derivation as the
 * fallback.
 *
 * The axes resolve independently, and a brand may well specify one and not the
 * other — an empty DOMAIN set is a legitimate answer meaning "no preference",
 * not a failure. Only a missing ROLE target falls through to the generic set,
 * because a brand with no idea who it wants is the case the generic-target cap
 * exists to flag.
 */
export function resolveTargets(
  org: OrgClassification,
  brief: ScoringBrief,
  goalKey: string | undefined
): TargetSets {
  // Goal picks who counts (Unit 41 v3): the campaign goal's roles fold into the
  // PRIMARY target set, so the goal acts THROUGH the audience match rather than
  // as its own score (developer_adoption makes developers a target). Most goals
  // say nothing about domain — GOAL_DOMAINS is deliberately sparse.
  const goalRoles = goalKey && GOAL_ROLES[goalKey] ? GOAL_ROLES[goalKey] : [];
  const goalDomains =
    goalKey && GOAL_DOMAINS[goalKey] ? GOAL_DOMAINS[goalKey] : [];

  const text = [
    org.productCategory,
    org.targetUser,
    brief.productCategory,
    brief.targetUser,
    ...(org.keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  // --- domains (no generic fallback: "no preference" is a real answer) ---
  const td = org.targetDomains;
  let domains: TargetTier<AudienceDomain>;
  if (td && td.primary.length > 0) {
    const primary = new Set([...td.primary, ...goalDomains]);
    domains = {
      primary,
      secondary: new Set(td.secondary.filter((d) => !primary.has(d))),
    };
  } else {
    const primary = new Set<AudienceDomain>(goalDomains);
    for (const { re, domains: ds } of KEYWORD_DOMAINS) {
      if (re.test(text)) for (const d of ds) primary.add(d);
    }
    domains = { primary, secondary: new Set() };
  }

  // --- roles ---
  const tr = org.targetRoles;
  if (tr && tr.primary.length > 0) {
    const primary = new Set(
      [...tr.primary, ...goalRoles].filter((r) => !NON_TARGET_ROLE.has(r))
    );
    return {
      roles: {
        primary,
        secondary: new Set(
          tr.secondary.filter((r) => !NON_TARGET_ROLE.has(r) && !primary.has(r))
        ),
      },
      domains,
      source: "llm",
    };
  }

  const primary = new Set<AudienceRole>(goalRoles);
  for (const { re, roles } of KEYWORD_ROLES) {
    if (re.test(text)) for (const r of roles) primary.add(r);
  }
  if (primary.size > 0) {
    return {
      roles: { primary, secondary: new Set() },
      domains,
      source: "keywords",
    };
  }
  return {
    roles: { primary: new Set(GENERIC_TARGET_ROLES), secondary: new Set() },
    domains,
    source: "generic",
  };
}

// --- human-weighted matching --------------------------------------------------

type MatchResult = { matchedShare: number; humanCount: number };

/**
 * How well ONE account fits the brand's target, on both axes. 0..1.
 *
 * Role gates: the wrong role is not your customer, whatever space they are in,
 * so roleWeight 0 zeroes the account. Domain then modulates rather than gates —
 * a developer in the wrong space is still a developer, and pretending otherwise
 * would swing the score violently on a single coarse label. `DOMAIN_FLOOR` is
 * what a right-role/wrong-domain account is worth.
 *
 * A brand with no domain preference scores every domain as a full match, so
 * this reduces exactly to the pre-Unit-43 role-only behaviour.
 */
export function accountFit(a: AudienceAccount, targets: TargetSets): number {
  const roleW = targets.roles.primary.has(a.role)
    ? 1
    : targets.roles.secondary.has(a.role)
      ? SECONDARY_TARGET_WEIGHT
      : 0;
  if (roleW === 0) return 0;

  const noPreference =
    targets.domains.primary.size === 0 && targets.domains.secondary.size === 0;
  const domainW = noPreference
    ? 1
    : targets.domains.primary.has(a.domain)
      ? 1
      : targets.domains.secondary.has(a.domain)
        ? SECONDARY_TARGET_WEIGHT
        : 0;

  // Farmers keep their real role and domain (that is the point of splitting
  // quality out) but convert at much lower intent, so they are discounted here
  // rather than being silently worth a full match — see FARMER_WEIGHT_MATCH.
  const intent = a.quality === "farmer" ? FARMER_WEIGHT_MATCH : 1;

  // How much a wrong domain costs depends on the ROLE — see ROLE_DOMAIN_FLOOR.
  const floor = ROLE_DOMAIN_FLOOR[a.role] ?? 0;
  return roleW * (floor + (1 - floor) * domainW) * intent;
}

/** Does this account count as a target HEADCOUNT (as opposed to a weight)? Used
 *  by the reach and geo dials, which count people rather than score them. */
export function isTargetAccount(
  a: AudienceAccount,
  targets: TargetSets
): boolean {
  return accountFit(a, targets) > 0;
}

/** Matched share over HUMAN accounts only (quality not bot/giveaway_hunter —
 *  their harm lives in audience_quality/bot_farm_risk, so they no longer
 *  triple-punish), weighted by engagement source (reply/quote 1.0, retweet 0.5)
 *  and by the two-axis account fit above. */
export function weightedMatch(
  accounts: AudienceAccount[],
  targets: TargetSets
): MatchResult {
  let matched = 0;
  let total = 0;
  let humanCount = 0;
  for (const a of accounts) {
    if (!isHuman(a)) continue;
    const w = SOURCE_WEIGHTS[a.source] ?? 1;
    total += w;
    humanCount++;
    matched += w * accountFit(a, targets);
  }
  return { matchedShare: total > 0 ? matched / total : 0, humanCount };
}

// --- expected reach (Phase B) ------------------------------------------------

/** Expected reach: typical engaged interactions per post × the matched-target
 *  share of the classified audience = ~how many of the brand's target customers
 *  engage per post. A HEADCOUNT (not a quality score), so no source/tier
 *  weighting — anyone in a primary OR secondary target bucket counts once.
 *  Realness is baked in: the denominator is ALL classified engagers
 *  (bots/farmers/giveaway included, exactly as they inflate the raw per-post
 *  volume), so a fake-heavy audience yields a proportionally smaller matched
 *  reach. Shown beside the fit score, never blended into it (Unit 41). */
export function expectedReach(
  accounts: AudienceAccount[],
  targets: TargetSets,
  avgEngagedPerPost: number | undefined,
  sampleLevel: ConfidenceLevel
): ExpectedReach {
  const total = accounts.length;
  let matched = 0;
  for (const a of accounts) if (isTargetAccount(a, targets)) matched++;
  const matchedShareOfEngagers = total > 0 ? matched / total : 0;
  const avg =
    typeof avgEngagedPerPost === "number" && Number.isFinite(avgEngagedPerPost)
      ? Math.max(0, avgEngagedPerPost)
      : 0;
  return {
    avgEngagedPerPost: Math.round(avg),
    matchedPerPost: Math.round(avg * matchedShareOfEngagers * 10) / 10,
    matchedShareOfEngagers,
    confidence: total === 0 ? "low" : sampleLevel,
  };
}

// --- audience geography (Phase C) -------------------------------------------

const EMPTY_REGIONS: ReadonlySet<AudienceRegion> = new Set();

const knownRegion = (r: AudienceRegion | undefined): r is AudienceRegion =>
  r !== undefined && r !== "unknown";

export type GeoTilt = {
  /** Multiplier applied to the base match (1 = no change). */
  factor: number;
  /** Matched-target accounts we could place into a known region. */
  placed: number;
  /** Placed matched accounts / all matched accounts (0-1). */
  coverage: number;
  /** Share of placed matched accounts sitting in the brand's valued regions. */
  valuedShare: number;
};

/** Soft geography tilt on the audience match (Unit 41 Phase C): among the
 *  MATCHED target accounts, what share sit in the brand's economically-valued
 *  regions? Bounded (±GEO_TILT_MAX) and scaled by coverage — X location data is
 *  thin, so a mostly-unplaceable audience barely moves. Neutral (factor 1) when
 *  the brand has no valued regions or nothing could be placed. Geography is
 *  part of "is this the right audience", so it tilts the fit — softly. */
export function geoTiltFactor(
  accounts: AudienceAccount[],
  targets: TargetSets,
  valuedRegions: ReadonlySet<AudienceRegion>
): GeoTilt {
  if (valuedRegions.size === 0) {
    return { factor: 1, placed: 0, coverage: 0, valuedShare: 0 };
  }
  let matched = 0;
  let placed = 0;
  let valued = 0;
  for (const a of accounts) {
    if (!isTargetAccount(a, targets)) continue;
    matched++;
    if (knownRegion(a.region)) {
      placed++;
      if (valuedRegions.has(a.region)) valued++;
    }
  }
  if (matched === 0 || placed === 0) {
    return { factor: 1, placed: 0, coverage: 0, valuedShare: 0 };
  }
  const valuedShare = valued / placed;
  const coverage = placed / matched;
  const tilt = GEO_TILT_MAX * coverage * (2 * valuedShare - 1);
  return { factor: 1 + tilt, placed, coverage, valuedShare };
}

/** Region breakdown of the engaged audience for the geo dial (Unit 41 Phase C).
 *  Shares are over PLACED accounts; `coverage` is placed / total classified. */
export function regionDistribution(
  accounts: AudienceAccount[]
): RegionDistribution {
  const counts = new Map<AudienceRegion, number>();
  let placed = 0;
  for (const a of accounts) {
    if (knownRegion(a.region)) {
      placed++;
      counts.set(a.region, (counts.get(a.region) ?? 0) + 1);
    }
  }
  const regions: RegionDistribution["regions"] = {};
  for (const [region, count] of counts) {
    regions[region] = { count, share: placed > 0 ? count / placed : 0 };
  }
  return {
    placed,
    coverage: accounts.length > 0 ? placed / accounts.length : 0,
    regions,
  };
}

// --- activity + originality fit multipliers (Unit 48) ------------------------

export type FitFactor = {
  /** Multiplier applied to the overall fit (1 = no penalty, down-only). */
  factor: number;
  /** Reason line for the overall score; null when there is nothing to say. */
  reason: string | null;
};

/** Down-only activity multiplier from days since the last ORIGINAL post. A
 *  brand buys future posts; a dormant creator's audience match describes a
 *  feed that has stopped. Undefined/invalid input means no timestamp data was
 *  available, which skips the penalty rather than inventing one. */
export function activityFactor(
  daysSinceLastOriginalPost: number | undefined,
  originalPostsPerWeek: number | undefined
): FitFactor {
  const days = daysSinceLastOriginalPost;
  if (typeof days !== "number" || !Number.isFinite(days) || days < 0) {
    return { factor: 1, reason: null };
  }
  const cadence =
    typeof originalPostsPerWeek === "number" &&
    Number.isFinite(originalPostsPerWeek)
      ? ` (~${Math.round(originalPostsPerWeek * 10) / 10} original posts/week over the sampled window)`
      : "";
  const d = Math.round(days);
  const factor = curve(days, ACTIVITY_ANCHORS);
  if (factor >= 1) {
    return {
      factor: 1,
      reason: `Active: last original post ${d} day${d === 1 ? "" : "s"} ago${cadence}.`,
    };
  }
  return {
    factor,
    reason: `Low activity: last original post ${d} days ago${cadence}. Fit multiplied by ${factor.toFixed(2)}: a brand is buying future posts, and this feed has slowed or stopped.`,
  };
}

/** Down-only originality multiplier from the repost share of the fetched
 *  timeline, RELIEVED by original cadence (user decision, 2026-07-23):
 *  reposting freely is fine as long as the creator keeps shipping original
 *  content — reposts already carry zero weight in reach, top posts, and
 *  content analysis. The penalty targets accounts whose OWN voice has thinned,
 *  not active curators. Unknown cadence keeps the penalty in full. */
export function originalityFactor(
  repostShare: number | undefined,
  originalPostsPerWeek: number | undefined
): FitFactor {
  if (typeof repostShare !== "number" || !Number.isFinite(repostShare)) {
    return { factor: 1, reason: null };
  }
  const share = Math.max(0, Math.min(1, repostShare));
  const base = curve(share, ORIGINALITY_ANCHORS);
  if (base >= 1) {
    return {
      factor: 1,
      reason:
        share > 0
          ? `${pct(share)} of the fetched timeline is reposts: within the normal curation range, no penalty.`
          : null,
    };
  }
  const cadence =
    typeof originalPostsPerWeek === "number" &&
    Number.isFinite(originalPostsPerWeek) &&
    originalPostsPerWeek >= 0
      ? originalPostsPerWeek
      : undefined;
  const severity =
    cadence === undefined
      ? 1
      : 1 - Math.min(1, cadence / ORIGINALITY_CADENCE_RELIEF_PER_WEEK);
  const factor = 1 - (1 - base) * severity;
  const rate =
    cadence === undefined ? "" : `~${Math.round(cadence * 10) / 10}`;
  if (factor >= 1) {
    return {
      factor: 1,
      reason: `${pct(share)} of the fetched timeline is reposts, but original output is healthy (${rate} original posts/week): no penalty. Reposts still carry no weight in reach or audience analysis.`,
    };
  }
  return {
    factor,
    reason:
      cadence === undefined
        ? `Heavy reposting: ${pct(share)} of the fetched timeline is reposts of other accounts rather than original content. Fit multiplied by ${factor.toFixed(2)}.`
        : `Heavy reposting with thin original output: ${pct(share)} of the timeline is reposts and only ${rate} original posts/week. Fit multiplied by ${factor.toFixed(2)}.`,
  };
}

// --- metrics --------------------------------------------------------------

export function engagedAudienceMatch(
  accounts: AudienceAccount[],
  dist: AudienceDistribution,
  targets: TargetSets,
  sampleLevel: ConfidenceLevel,
  valuedRegions?: ReadonlySet<AudienceRegion>
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
      ? "brand-inferred targets"
      : targets.source === "keywords"
        ? "keyword-derived targets"
        : "generic crypto-audience targets";
  const reasons = [
    `${pct(matchedShare)} of the real engaged audience (${humanCount} humans, reply/quote-weighted) matches ${sourceNote}: ` +
      `roles ${[...targets.roles.primary].join(", ") || "(none)"}${targets.roles.secondary.size > 0 ? ` (+${[...targets.roles.secondary].join(", ")})` : ""}` +
      `; domains ${[...targets.domains.primary].join(", ") || "no preference"}${targets.domains.secondary.size > 0 ? ` (+${[...targets.domains.secondary].join(", ")})` : ""}.`,
    "Calibrated: real engaged audiences are heterogeneous — ~30% target share is a strong signal, 45%+ exceptional.",
  ];

  // v3: the fit score IS this match — a straight curve of the matched share.
  // No intent damp/floor, no identity modifiers. The audience speaks.
  const base = curve(matchedShare, EAM_ANCHORS);

  // Soft geography tilt (Phase C): are the matched target accounts in the
  // brand's economically-valued regions?
  const geo = geoTiltFactor(accounts, targets, valuedRegions ?? EMPTY_REGIONS);
  let value = clampRound(base * geo.factor);
  if (geo.placed > 0 && geo.factor !== 1) {
    const dir = geo.factor >= 1 ? "up" : "down";
    reasons.push(
      `Audience geography: ${pct(geo.valuedShare)} of placed target accounts sit in the brand's valued regions (${geo.placed} placed, coverage ${pct(geo.coverage)}); fit tilted ${dir} ${Math.abs(Math.round((geo.factor - 1) * 100))}%.`
    );
  }

  // Unknown-target guard (Unit 41): when the brand's target couldn't be
  // determined we matched against a generic "any real crypto audience" set —
  // that reflects crypto-ness, not confirmed brand fit. Cap it (never a
  // confident STRONG off a mystery brand) and drop confidence to low.
  let confidence = audienceConfidence(dist, sampleLevel);
  if (targets.source === "generic") {
    value = Math.min(value, GENERIC_TARGET_MAX_FIT);
    confidence = "low";
    reasons.push(
      "Brand's target audience could not be determined — matched against a generic real-crypto audience, so this reflects crypto-ness, not confirmed fit. Capped and low-confidence; add product/target details for a true match."
    );
  }
  return sv(value, confidence, reasons);
}

export function audienceQuality(
  dist: AudienceDistribution,
  repeatEngagerShare: number,
  sampleLevel: ConfidenceLevel
): ScoreValue {
  if (dist.sampleSize === 0) {
    return sv(0, "low", ["No engaged accounts were sampled."]);
  }
  const bots = qualityShare(dist, "bot");
  const giveaway = qualityShare(dist, "giveaway_hunter");
  const farmers = qualityShare(dist, "farmer");
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
  if (goalKey && GOAL_ROLES[goalKey]) {
    // Goal support = human-weighted coverage of union(goal roles, primary target
    // roles). Linear (a coverage ratio, not a rarity-adjusted match). Domain is
    // carried through unchanged: "does this audience support the goal" is a
    // question about who they are, but a developer in a wholly unrelated space
    // still supports developer_adoption only partially.
    const goalRoles = new Set<AudienceRole>([
      ...GOAL_ROLES[goalKey],
      ...targets.roles.primary,
    ]);
    const { matchedShare, humanCount } = weightedMatch(accounts, {
      roles: { primary: goalRoles, secondary: new Set() },
      domains: targets.domains,
      source: targets.source,
    });
    if (dist.sampleSize === 0 || humanCount === 0) {
      return sv(0, "low", ["No usable engaged accounts to assess goal support."]);
    }
    return sv(clampRound(100 * matchedShare), audienceConfidence(dist, sampleLevel), [
      `Goal "${goalKey}" supported by ${pct(matchedShare)} of the real engaged audience (${GOAL_ROLES[goalKey].join(", ")}).`,
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
    // Visual-only promos (Unit 31): image labeled promo_graphic under a post
    // whose TEXT was not flagged — a shill graphic is still a promo.
    const promoIds = new Set(promos.map((l) => l.postId));
    const visualOnlyPromoIds = new Set(
      (content.mediaLabels ?? [])
        .filter((m) => m.kind === "promo_graphic" && !promoIds.has(m.postId))
        .map((m) => m.postId)
    );
    const promoCount = promos.length + visualOnlyPromoIds.size;
    const saturation = Math.min(1, promoCount / labels.length);
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
      `${promoCount}/${labels.length} labeled posts are promotional (${pct(saturation)} saturation).`,
    ];
    if (visualOnlyPromoIds.size > 0) {
      reasons.push(
        `${visualOnlyPromoIds.size} post(s) counted from promo GRAPHICS under non-promotional text (visual shilling).`
      );
    }
    if (promoCount > 0) {
      reasons.push(
        `${pct(unrelatedShare)} of promos are outside the creator's domain; ${pct(lowQualityShare)} promote low-quality projects.`,
        quality < 0.25
          ? "In-domain, decent-quality promotion is the creator business model, so the risk is discounted accordingly."
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

/** Deterministic visual-content profile from the 29B media labels (Unit 31).
 *  Informational: appended to content_fit reasons; substantive share has no
 *  numeric effect yet (no calibration label demands one). */
export function mediaProfileReason(
  content: KolContentClassification
): string | null {
  const labels = content.mediaLabels ?? [];
  if (labels.length === 0) return null;
  const share = (kinds: string[]) =>
    labels.filter((m) => kinds.includes(m.kind)).length / labels.length;
  const substantive = share(["chart_or_data", "screenshot_text"]);
  const meme = share(["meme"]);
  const promo = share(["promo_graphic"]);
  return (
    `Visual content across ${labels.length} labeled image(s): ` +
    `${pct(substantive)} charts/data/analysis, ${pct(meme)} memes, ${pct(promo)} promo graphics.`
  );
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
  const bots = qualityShare(dist, "bot");
  const giveaway = qualityShare(dist, "giveaway_hunter");
  const farmers = qualityShare(dist, "farmer");
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
