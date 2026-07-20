// Unit 41 regression: Scoring v3 ("audience-honest"). Verifies the
// calibration-curve math, human-only engaged-audience match — which IS the fit
// score now (overall_fit == engaged_audience_match) — baseline-adjusted
// quality/bot risks, saturation-based promo risk + gates, flags-based brand
// safety, rubric content fit (informational), goal normalization, geo/language
// (informational), confidence, determinism — and the BENCHMARK: a well-matched
// Uniswap-shaped audience (~47% real target) lands STRONG on the AUDIENCE
// ALONE, with NO founder/identity boost (v2 needed a +6 authority modifier +
// GOOD floor; v3 deletes them).
//
// Run after `pnpm build`:  node scripts/checks/scoring-v3.regression.cjs
// (or `pnpm check:scoring-v3`). Pure math — no network, no keys, no DB.

const s = require("../../packages/scoring/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

// --- fixture helpers ---------------------------------------------------------

/**
 * accounts + distribution from {"role/domain[/quality]": count}, all REPLY
 * unless overridden. Unit 43: the old {bucket: count} form could not express
 * the cases that matter now — a farming DEVELOPER, or the same role in two
 * different spaces — because the flat taxonomy had nowhere to put them.
 */
function audienceOf(spec, source = "REPLY") {
  const accounts = [];
  let i = 0;
  for (const [key, count] of Object.entries(spec)) {
    const [role, domain, quality = "real"] = key.split("/");
    for (let k = 0; k < count; k++) {
      accounts.push({
        accountId: `a${i}`, handle: `h${i++}`, source, role, domain, quality,
        signals: { botScore: quality === "bot" ? 0.9 : 0.1, emptyBio: false, farmingSignals: [] },
      });
    }
  }
  return { accounts, distribution: distOf(accounts) };
}

/** Distribution over all three axes, same denominator on each. */
function distOf(accounts) {
  const tally = (pick) => {
    const counts = {};
    for (const a of accounts) counts[pick(a)] = (counts[pick(a)] ?? 0) + 1;
    const out = {};
    for (const [k, c] of Object.entries(counts)) {
      out[k] = { count: c, share: accounts.length === 0 ? 0 : c / accounts.length };
    }
    return out;
  };
  return {
    sampleSize: accounts.length,
    roles: tally((a) => a.role),
    domains: tally((a) => a.domain),
    quality: tally((a) => a.quality),
  };
}

const EMPTY_AUDIENCE = { accounts: [], distribution: distOf([]) };

const baseInput = (audience, overrides = {}) => ({
  org: {
    productCategory: "DeFi / AMM", targetUser: "LPs, traders, DeFi builders",
    keywords: ["amm", "swap", "liquidity"], confidence: "high",
    targetRoles: { primary: ["enthusiast", "trader", "developer"], secondary: ["founder", "investor", "researcher"] },
    targetDomains: { primary: ["crypto_defi", "crypto_infra"], secondary: [] },
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
// Re-expressed on the three axes; the old bucket names map as the comments show.
const UNISWAP_AUDIENCE = audienceOf({
  "enthusiast/crypto_defi": 45,          // defi_users
  "enthusiast/general": 40,              // non_crypto
  "developer/crypto_infra": 31,          // developers
  "trader/crypto_defi": 28,              // traders
  "unknown/unknown/bot": 27,             // bots_spam
  "enthusiast/crypto_memecoins": 25,     // meme_degens
  "enthusiast/crypto_infra/farmer": 20,  // airdrop_farmers
  "researcher/crypto_infra": 18,         // infra_research
  "founder/crypto_infra": 15,            // founders
  "creator/crypto_infra": 14,            // kols_creators
  "investor/crypto_infra": 12,           // investors_vcs
  "operator/crypto_infra": 8,            // community_managers
  "enthusiast/crypto_nft_gaming": 7,     // nft_gaming
  "developer/ai": 6,                     // ai_crypto
  "unknown/unknown/giveaway_hunter": 4,  // giveaway_hunters
});

// --- 1. curve math -----------------------------------------------------------
// x-values recalibrated in Unit 43 (see EAM_ANCHORS): two-axis matching awards
// partial credit, so the same audience yields a higher raw share and the curve
// was shifted right to keep the verdict bands meaning what they say.
ck("curve endpoints", s.curve(0, s.EAM_ANCHORS) === 0 && s.curve(0.66, s.EAM_ANCHORS) === 100);
ck("curve clamps beyond range", s.curve(0.9, s.EAM_ANCHORS) === 100 && s.curve(-1, s.EAM_ANCHORS) === 0);
ck("curve interpolates linearly", Math.abs(s.curve(0.2475, s.EAM_ANCHORS) - 65) < 1e-9);

// --- 2. THE BENCHMARK: a well-matched Uniswap audience is STRONG on the
//        AUDIENCE alone — no identity boost of any kind ----------------------
{
  const input = baseInput(UNISWAP_AUDIENCE, {
    // A founder relationship is present but MUST be ignored by v3 scoring.
    contentFitAssessment: { topicalAdjacency: 5, audienceOverlapPotential: 5, naturalMentionFit: 5, sharedTopics: ["defi", "amm"], rationale: "Founder of the org's own protocol domain.", relationship: "founder_or_core_team", relationshipEvidence: "bio" },
  });
  const { scores, verdict } = s.scoreAnalysis(input);
  ck(`benchmark verdict STRONG (got ${verdict}, overall ${scores.overall.value})`, verdict === "STRONG" && scores.overall.value >= 80);
  ck("benchmark EAM >= 85", scores.components.engaged_audience_match.value >= 85);
  ck("v3 invariant: overall_fit == engaged_audience_match", scores.overall.value === scores.components.engaged_audience_match.value);
  ck("benchmark confidence high (300 classified + text)", scores.confidence === "high");
  const again = s.scoreAnalysis(input);
  ck("deterministic (full result incl. expectedReach)", JSON.stringify(again) === JSON.stringify(s.scoreAnalysis(input)));
}

// --- 3. human-only EAM: adding bots must NOT dilute the match ---------------
{
  const clean = baseInput(audienceOf({ "enthusiast/crypto_defi": 40, "enthusiast/general": 60 }));
  const botted = baseInput(audienceOf({ "enthusiast/crypto_defi": 40, "enthusiast/general": 60, "unknown/unknown/bot": 100 }));
  const a = s.scoreAnalysis(clean).scores.components;
  const b = s.scoreAnalysis(botted).scores.components;
  ck("EAM unchanged when bots added (human denominator)", a.engaged_audience_match.value === b.engaged_audience_match.value);
  ck("bots instead hit audience_quality + bot_farm_risk", b.audience_quality.value < a.audience_quality.value && b.bot_farm_risk.value > a.bot_farm_risk.value);
}

// --- 4. baselines: endemic junk is free -------------------------------------
{
  const mild = baseInput(audienceOf({ "enthusiast/crypto_defi": 92, "unknown/unknown/bot": 8 }), { sample: { repeatEngagerShare: 0 } });
  const { scores } = s.scoreAnalysis(mild);
  ck("8% bots -> no quality penalty (baseline)", scores.components.audience_quality.value === 100);
  ck("8% bots -> zero bot/farm risk (baseline)", scores.components.bot_farm_risk.value === 0);
}

// --- 5. promo risk: saturation × quality, not pattern counts ----------------
{
  const labels = (n, promo, related, quality) => Array.from({ length: n }, (_, i) => (i < promo ? { postId: `p${i}`, isPromo: true, promoRelated: related, promoQuality: quality } : { postId: `p${i}`, isPromo: false }));
  const aud = audienceOf({ "enthusiast/crypto_defi": 100 });
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
  const aud = audienceOf({ "enthusiast/crypto_memecoins": 60, "enthusiast/crypto_defi": 40 });
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
  const aud = audienceOf({ "enthusiast/crypto_defi": 100 });
  const rubric = s.scoreAnalysis(baseInput(aud, { contentFitAssessment: { topicalAdjacency: 3, audienceOverlapPotential: 3, naturalMentionFit: 3, sharedTopics: [], rationale: "adjacent" } })).scores.components.content_fit;
  ck("rubric 3/3/3 (adjacent) -> 70", rubric.value === 70);
  const fallback = s.scoreAnalysis(baseInput(aud)).scores.components.content_fit;
  ck("no assessment -> token fallback at low confidence", fallback.confidence === "low");
}

// --- 9. goal normalization -----------------------------------------------------
{
  const aud = audienceOf({ "developer/crypto_infra": 30, "researcher/crypto_infra": 10, "enthusiast/general": 60 });
  const fuzzy = s.scoreAnalysis(baseInput(aud, { org: { campaignGoal: "Developer Adoption" }, brief: {} }));
  ck("fuzzy goal string matched to developer_adoption", fuzzy.scores.components.campaign_goal_fit.reasons[0].includes("developer_adoption"));
  const unknown = s.scoreAnalysis(baseInput(aud, { org: { campaignGoal: "growth hacking wizardry" } }));
  ck("unrecognized goal -> EAM proxy with explicit reason", unknown.scores.components.campaign_goal_fit.reasons[0].includes("not recognized"));
}

// --- 10. geo/language v2 -------------------------------------------------------
{
  const aud = audienceOf({ "enthusiast/crypto_defi": 100 });
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
  const small = audienceOf({ "enthusiast/crypto_defi": 16 });
  const c = s.scoreAnalysis(baseInput(small, { sample: { kolPostsSampled: 12, engagedAccountsClassified: 16 }, evidence: { hasEngagementText: true } })).scores.confidence;
  ck("small classified sample -> medium", c === "medium");
  const noText = s.scoreAnalysis(baseInput(UNISWAP_AUDIENCE, { evidence: { hasEngagementText: false } })).scores.confidence;
  ck("300 classified WITHOUT reply text -> medium (text is a confidence lever)", noText === "medium");
}

// --- 12. expected reach (Phase B) — a DIAL, never blended into the fit -------
{
  const withVol = baseInput(UNISWAP_AUDIENCE, { sample: { avgEngagedPerPost: 100 } });
  const r = s.scoreAnalysis(withVol).expectedReach;
  ck("reach: avgEngagedPerPost passthrough (rounded)", r.avgEngagedPerPost === 100);
  ck("reach: matched share of engagers in (0,1)", r.matchedShareOfEngagers > 0 && r.matchedShareOfEngagers < 1);
  ck("reach: matchedPerPost = avg × matched share", Math.abs(r.matchedPerPost - 100 * r.matchedShareOfEngagers) < 0.06);

  // The load-bearing v3 property: reach volume must NOT move the fit score.
  const fitHi = s.scoreAnalysis(baseInput(UNISWAP_AUDIENCE, { sample: { avgEngagedPerPost: 100000 } })).scores.overall.value;
  const fitLo = s.scoreAnalysis(baseInput(UNISWAP_AUDIENCE, { sample: { avgEngagedPerPost: 1 } })).scores.overall.value;
  ck("reach: fit score is identical regardless of reach volume (never blended)", fitHi === fitLo);

  const noVol = s.scoreAnalysis(baseInput(UNISWAP_AUDIENCE)).expectedReach;
  ck("reach: no volume -> 0 matchedPerPost, share still computed", noVol.avgEngagedPerPost === 0 && noVol.matchedPerPost === 0 && noVol.matchedShareOfEngagers > 0);

  const empty = s.scoreAnalysis(baseInput(EMPTY_AUDIENCE, { sample: { avgEngagedPerPost: 50 } })).expectedReach;
  ck("reach: empty audience -> 0 matched, low confidence", empty.matchedPerPost === 0 && empty.confidence === "low");

  // Realness baked in: injecting bots (non-target) lowers the matched share.
  const clean = s.scoreAnalysis(baseInput(audienceOf({ "enthusiast/crypto_defi": 50 }), { sample: { avgEngagedPerPost: 100 } })).expectedReach;
  const botted = s.scoreAnalysis(baseInput(audienceOf({ "enthusiast/crypto_defi": 50, "unknown/unknown/bot": 50 }), { sample: { avgEngagedPerPost: 100 } })).expectedReach;
  ck("reach: bots dilute matched reach (realness baked into the denominator)", botted.matchedPerPost < clean.matchedPerPost);
}

// --- 13. audience geography (Phase C) — soft tilt + dial ---------------------
{
  // defi_users (a target) carrying regions, plus non-target filler so the base
  // match sits mid-curve (~30% -> 75) and the ± tilt is visible (not clamped).
  const geoAud = (targetRegions, filler = 70) => {
    const accounts = [];
    let i = 0;
    for (const [region, count] of Object.entries(targetRegions)) {
      for (let k = 0; k < count; k++) {
        accounts.push({ accountId: `t${i}`, handle: `t${i++}`, source: "REPLY", role: "enthusiast", domain: "crypto_defi", quality: "real", ...(region === "none" ? {} : { region }), signals: { botScore: 0.1, farmingSignals: [] } });
      }
    }
    // Filler must miss on BOTH axes, or it would carry partial credit through
    // the domain floor and flatten the tilt this section is measuring.
    for (let k = 0; k < filler; k++) accounts.push({ accountId: `f${i}`, handle: `f${i++}`, source: "REPLY", role: "creator", domain: "general", quality: "real", signals: { botScore: 0.1, farmingSignals: [] } });
    return { accounts, distribution: distOf(accounts) };
  };
  const VALUED = { org: { valuedRegions: ["subsaharan_africa", "latam", "south_asia"] } };
  const eamOf = (inp) => s.scoreAnalysis(inp).scores.components.engaged_audience_match.value;

  const africaHeavy = eamOf(baseInput(geoAud({ subsaharan_africa: 24, north_america: 6 }), VALUED));
  const usHeavy = eamOf(baseInput(geoAud({ subsaharan_africa: 6, north_america: 24 }), VALUED));
  ck(`geo: valued-region audience tilts fit UP vs off-region (${africaHeavy} > ${usHeavy})`, africaHeavy > usHeavy);

  const neutral = eamOf(baseInput(geoAud({ subsaharan_africa: 24, north_america: 6 })));
  ck(`geo: no valuedRegions -> no tilt (${neutral} unchanged)`, neutral === eamOf(baseInput(geoAud({ subsaharan_africa: 6, north_america: 24 }))));

  const full = eamOf(baseInput(geoAud({ subsaharan_africa: 30 }), VALUED));
  const noTilt = eamOf(baseInput(geoAud({ subsaharan_africa: 30 })));
  ck(`geo: tilt bounded to ~15% (${full} <= ${Math.round(noTilt * 1.15) + 1})`, full <= Math.round(noTilt * 1.15) + 1);

  const half = eamOf(baseInput(geoAud({ subsaharan_africa: 15, none: 15 }), VALUED));
  ck(`geo: lower placement coverage -> smaller tilt (${half} < ${full})`, half < full);

  const rd = s.scoreAnalysis(baseInput(geoAud({ subsaharan_africa: 30, north_america: 10, none: 60 }, 0))).audienceRegions;
  ck(`geo dial: coverage = placed/total (${rd.placed}/100)`, rd.placed === 40 && Math.abs(rd.coverage - 0.4) < 1e-9);
  ck("geo dial: shares are over placed accounts", Math.abs(rd.regions.subsaharan_africa.share - 0.75) < 1e-9);
}

// --- 14. goal picks who counts (folds into the target set) -------------------
{
  const devAud = audienceOf({ "developer/crypto_infra": 50, "creator/general": 50 });
  const orgDefiOnly = { targetRoles: { primary: ["enthusiast"], secondary: [] }, targetDomains: { primary: ["crypto_defi"], secondary: [] } };
  const noGoal = s.scoreAnalysis(baseInput(devAud, { org: orgDefiOnly, brief: {} })).scores.components.engaged_audience_match.value;
  const devGoal = s.scoreAnalysis(baseInput(devAud, { org: { ...orgDefiOnly, campaignGoal: "developer adoption" }, brief: {} })).scores.components.engaged_audience_match.value;
  ck(`goal: developer_adoption folds developers into targets, lifting a dev audience (${devGoal} > ${noGoal})`, devGoal > noGoal);
}

// --- 15. unknown-target guard (Unit 41 live-verification fix) ----------------
// When the brand can't be classified, targets fall back to a generic "any real
// crypto" set. A high generic match must NOT surface a confident STRONG.
{
  const genericAud = audienceOf({ "enthusiast/crypto_defi": 80, "creator/general": 20 }); // ~80% "match"
  const g = s.scoreAnalysis(
    baseInput(genericAud, {
      org: { targetRoles: { primary: [], secondary: [] }, targetDomains: { primary: [], secondary: [] }, productCategory: "", targetUser: "", keywords: [] },
      brief: {},
    })
  );
  const eam = g.scores.components.engaged_audience_match.value;
  ck(`generic target: high match (raw ~100) capped to <= 84 (got ${eam})`, eam <= 84);
  ck("generic target: overall still == EAM (invariant holds, both capped)", g.scores.overall.value === eam);
  ck(`generic target: verdict is NOT a confident STRONG (got ${g.verdict})`, g.verdict !== "STRONG");
  ck("generic target: confidence forced to low", g.scores.confidence === "low");
  // A KNOWN target with the same audience is NOT capped (control).
  const known = s.scoreAnalysis(baseInput(genericAud, { org: { targetRoles: { primary: ["enthusiast"], secondary: [] }, targetDomains: { primary: ["crypto_defi"], secondary: [] } }, brief: {} }));
  ck(`known target: same audience NOT capped (got ${known.scores.overall.value} > 84)`, known.scores.overall.value > 84);
}

console.log(`\nSCORING V3 REGRESSION (Unit 41): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
