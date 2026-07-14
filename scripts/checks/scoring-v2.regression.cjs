// Unit 29C regression: Scoring v2. Verifies the calibration-curve math,
// human-only engaged-audience match, baseline-adjusted quality/bot risks,
// saturation-based promo risk + softened gates, flags-based brand safety,
// rubric-based content fit, goal normalization, geo/language v2, confidence
// v2, determinism — and the BENCHMARK: a Uniswap × haydenzadams-shaped
// fixture (v1 scored it 40/WEAK) must land STRONG.
//
// Run after `pnpm build`:  node scripts/checks/scoring-v2.regression.cjs
// (or `pnpm check:scoring-v2`). Pure math — no network, no keys, no DB.

const s = require("../../packages/scoring/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

// --- fixture helpers ---------------------------------------------------------

/** accounts + distribution from {bucket: count}, all REPLY unless overridden. */
function audienceOf(bucketCounts, source = "REPLY") {
  const accounts = [];
  let i = 0;
  for (const [bucket, count] of Object.entries(bucketCounts)) {
    for (let k = 0; k < count; k++) {
      accounts.push({
        accountId: `a${i}`, handle: `h${i++}`, source, bucket,
        signals: { botScore: bucket === "bots_spam" ? 0.9 : 0.1, emptyBio: false, farmingSignals: [] },
      });
    }
  }
  const buckets = {};
  for (const [bucket, count] of Object.entries(bucketCounts)) {
    buckets[bucket] = { count, share: count / accounts.length };
  }
  return { accounts, distribution: { sampleSize: accounts.length, buckets } };
}

const baseInput = (audience, overrides = {}) => ({
  org: {
    productCategory: "DeFi / AMM", targetUser: "LPs, traders, DeFi builders",
    keywords: ["amm", "swap", "liquidity"], confidence: "high",
    targetBuckets: { primary: ["defi_users", "traders", "developers"], secondary: ["founders", "investors_vcs", "infra_research"] },
    ...overrides.org,
  },
  content: {
    themes: ["defi", "amm design"], verticals: ["defi"], style: "analytical", depth: "high",
    promoPatterns: [], repeatedTickers: [],
    postLabels: Array.from({ length: 40 }, (_, i) => ({ postId: `p${i}`, isPromo: false })),
    brandSafetyFlags: [], mediaLabels: [],
    ...overrides.content,
  },
  audience,
  sample: { kolPostsSampled: 100, kolRepliesSampled: 50, topPostsAnalyzed: 20, engagedAccountsSampled: 1500, engagedAccountsClassified: audience.distribution.sampleSize, repeatEngagerShare: 0.1, ...overrides.sample },
  evidence: { websiteFetched: false, docsFetched: false, hasEngagementText: true, ...overrides.evidence },
  brief: { campaignGoal: null, region: null, productCategory: null, targetUser: null, stage: null, ...overrides.brief },
  contentFitAssessment: overrides.contentFitAssessment,
  kolPostLangs: overrides.kolPostLangs ?? Array(100).fill("en"),
});

// The saved 2026-07-10 live-run shape: 300 classified, real founder-KOL mix.
const UNISWAP_AUDIENCE = audienceOf({
  defi_users: 45, non_crypto: 40, developers: 31, traders: 28, bots_spam: 27,
  meme_degens: 25, airdrop_farmers: 20, infra_research: 18, founders: 15,
  kols_creators: 14, investors_vcs: 12, community_managers: 8, nft_gaming: 7,
  ai_crypto: 6, giveaway_hunters: 4,
});

// --- 1. curve math -----------------------------------------------------------
ck("curve endpoints", s.curve(0, s.EAM_ANCHORS) === 0 && s.curve(0.6, s.EAM_ANCHORS) === 100);
ck("curve clamps beyond range", s.curve(0.9, s.EAM_ANCHORS) === 100 && s.curve(-1, s.EAM_ANCHORS) === 0);
ck("curve interpolates linearly", Math.abs(s.curve(0.225, s.EAM_ANCHORS) - 65) < 1e-9);

// --- 2. THE BENCHMARK: Uniswap × hayden shape must be STRONG -----------------
{
  const input = baseInput(UNISWAP_AUDIENCE, {
    contentFitAssessment: { topicalAdjacency: 5, audienceOverlapPotential: 5, naturalMentionFit: 5, sharedTopics: ["defi", "amm"], rationale: "Founder of the org's own protocol domain." },
  });
  const { scores, verdict } = s.scoreAnalysis(input);
  ck(`benchmark verdict STRONG (got ${verdict}, overall ${scores.overall.value})`, verdict === "STRONG" && scores.overall.value >= 80);
  ck("benchmark EAM >= 85", scores.components.engaged_audience_match.value >= 85);
  ck("benchmark confidence high (300 classified + text)", scores.confidence === "high");
  const again = s.scoreAnalysis(input);
  ck("deterministic", JSON.stringify(again) === JSON.stringify({ scores, verdict }));
}

// --- 3. human-only EAM: adding bots must NOT dilute the match ---------------
{
  const clean = baseInput(audienceOf({ defi_users: 40, non_crypto: 60 }));
  const botted = baseInput(audienceOf({ defi_users: 40, non_crypto: 60, bots_spam: 100 }));
  const a = s.scoreAnalysis(clean).scores.components;
  const b = s.scoreAnalysis(botted).scores.components;
  ck("EAM unchanged when bots added (human denominator)", a.engaged_audience_match.value === b.engaged_audience_match.value);
  ck("bots instead hit audience_quality + bot_farm_risk", b.audience_quality.value < a.audience_quality.value && b.bot_farm_risk.value > a.bot_farm_risk.value);
}

// --- 4. baselines: endemic junk is free -------------------------------------
{
  const mild = baseInput(audienceOf({ defi_users: 92, bots_spam: 8 }), { sample: { repeatEngagerShare: 0 } });
  const { scores } = s.scoreAnalysis(mild);
  ck("8% bots -> no quality penalty (baseline)", scores.components.audience_quality.value === 100);
  ck("8% bots -> zero bot/farm risk (baseline)", scores.components.bot_farm_risk.value === 0);
}

// --- 5. promo risk: saturation × quality, not pattern counts ----------------
{
  const labels = (n, promo, related, quality) => Array.from({ length: n }, (_, i) => (i < promo ? { postId: `p${i}`, isPromo: true, promoRelated: related, promoQuality: quality } : { postId: `p${i}`, isPromo: false }));
  const aud = audienceOf({ defi_users: 100 });
  const related = s.scoreAnalysis(baseInput(aud, { content: { postLabels: labels(40, 6, true, "ok") } })).scores.components.paid_promo_risk.value;
  const unrelated = s.scoreAnalysis(baseInput(aud, { content: { postLabels: labels(40, 6, false, "low") } })).scores.components.paid_promo_risk.value;
  ck(`related decent promos are near-free (${related} < 12)`, related < 12);
  ck(`same saturation, unrelated/low promos cost more (${unrelated} > ${related})`, unrelated > related);
  const legacy = s.scoreAnalysis(baseInput(aud, { content: { postLabels: undefined, promoPatterns: ["a", "b", "c", "d", "e", "f", "g"] } })).scores.components.paid_promo_risk;
  ck("legacy fallback capped + low confidence", legacy.value <= 60 && legacy.confidence === "low");
}

// --- 6. verdict gates (softened) ---------------------------------------------
{
  const none = { paidPromoRisk: 0, botFarmRisk: 0, promoUnrelatedShare: 0, brandSafety: 100 };
  ck("no gate: 90 -> STRONG", s.verdictFromScore(90, none) === "STRONG");
  ck("bot risk 84 does NOT gate", s.verdictFromScore(90, { ...none, botFarmRisk: 84 }) === "STRONG");
  ck("bot risk 86 caps at OKAY", s.verdictFromScore(90, { ...none, botFarmRisk: 86 }) === "OKAY");
  ck("bot risk 96 caps at WEAK", s.verdictFromScore(90, { ...none, botFarmRisk: 96 }) === "WEAK");
  ck("promo 90 but mostly RELATED does not gate", s.verdictFromScore(90, { ...none, paidPromoRisk: 90, promoUnrelatedShare: 0.3 }) === "STRONG");
  ck("promo 90 + mostly unrelated caps at OKAY", s.verdictFromScore(90, { ...none, paidPromoRisk: 90, promoUnrelatedShare: 0.8 }) === "OKAY");
  ck("gates never RAISE a verdict", s.verdictFromScore(20, { ...none, botFarmRisk: 86 }) === "AVOID");
}

// --- 7. brand safety: flags only ---------------------------------------------
{
  const aud = audienceOf({ meme_degens: 60, defi_users: 40 });
  const clean = s.scoreAnalysis(baseInput(aud)).scores.components.brand_safety.value;
  ck("no flags -> 100 (meme share no longer penalized; no promo leakage)", clean === 100);
  const flagged = s.scoreAnalysis(baseInput(aud, { content: { brandSafetyFlags: [
    { flag: "scam_or_rug_association", severity: "high", evidence: "post x" },
    { flag: "excessive_drama", severity: "low", evidence: "post y" },
  ] } })).scores.components.brand_safety.value;
  ck("high(35) + low(5) flags -> 60", flagged === 60);
}

// --- 8. content fit: rubric vs fallback --------------------------------------
{
  const aud = audienceOf({ defi_users: 100 });
  const rubric = s.scoreAnalysis(baseInput(aud, { contentFitAssessment: { topicalAdjacency: 3, audienceOverlapPotential: 3, naturalMentionFit: 3, sharedTopics: [], rationale: "adjacent" } })).scores.components.content_fit;
  ck("rubric 3/3/3 (adjacent) -> 70", rubric.value === 70);
  const fallback = s.scoreAnalysis(baseInput(aud)).scores.components.content_fit;
  ck("no assessment -> token fallback at low confidence", fallback.confidence === "low");
}

// --- 9. goal normalization -----------------------------------------------------
{
  const aud = audienceOf({ developers: 30, infra_research: 10, non_crypto: 60 });
  const fuzzy = s.scoreAnalysis(baseInput(aud, { org: { campaignGoal: "Developer Adoption" }, brief: {} }));
  ck("fuzzy goal string matched to developer_adoption", fuzzy.scores.components.campaign_goal_fit.reasons[0].includes("developer_adoption"));
  const unknown = s.scoreAnalysis(baseInput(aud, { org: { campaignGoal: "growth hacking wizardry" } }));
  ck("unrecognized goal -> EAM proxy with explicit reason", unknown.scores.components.campaign_goal_fit.reasons[0].includes("not recognized"));
}

// --- 10. geo/language v2 -------------------------------------------------------
{
  const aud = audienceOf({ defi_users: 100 });
  const neutral = s.scoreAnalysis(baseInput(aud)).scores.components.geo_language_fit;
  ck("no region + langs -> neutral 85 medium", neutral.value === 85 && neutral.confidence === "medium");
  const ko = s.scoreAnalysis(baseInput(aud, { brief: { region: "Korea" }, kolPostLangs: ["ko", "ko", "en", "und"] })).scores.components.geo_language_fit;
  ck("Korea + ko/en posts -> 100", ko.value === 100);
  const mismatch = s.scoreAnalysis(baseInput(aud, { brief: { region: "Korea" }, kolPostLangs: ["es", "es", "es", "es"] })).scores.components.geo_language_fit;
  ck("Korea + all-Spanish posts -> floor 30", mismatch.value === 30);
  const noLang = s.scoreAnalysis(baseInput(aud, { brief: { region: "Korea" }, kolPostLangs: [] })).scores.components.geo_language_fit;
  ck("region set but no lang data -> legacy 70 low", noLang.value === 70 && noLang.confidence === "low");
}

// --- 11. confidence v2 ---------------------------------------------------------
{
  const small = audienceOf({ defi_users: 16 });
  const c = s.scoreAnalysis(baseInput(small, { sample: { kolPostsSampled: 12, engagedAccountsClassified: 16 }, evidence: { hasEngagementText: true } })).scores.confidence;
  ck("small classified sample -> medium", c === "medium");
  const noText = s.scoreAnalysis(baseInput(UNISWAP_AUDIENCE, { evidence: { hasEngagementText: false } })).scores.confidence;
  ck("300 classified WITHOUT reply text -> medium (text is a confidence lever)", noText === "medium");
}

console.log(`\nSCORING V2 REGRESSION (29C): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
