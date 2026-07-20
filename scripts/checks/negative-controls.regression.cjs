// Unit 41 regression: v3 verdict gates + synthetic negative-control PATTERNS
// (farm / casino / raid / giveaway / promo-heavy shapes — not real handles,
// encoded here as scoring fixtures). Verifies under scoring v3: severe risk gates
// cap to AVOID; keyword/category overlap (content fit) does NOT defeat the
// gates; the promo gate alone is never AVOID; off-target audiences fall below
// the 5% target floor to AVOID on their own; identity/relationship is ignored
// (no founder floor); caps combine as the minimum.
//
// Run after `pnpm build`:  node scripts/checks/negative-controls.regression.cjs
// (or `pnpm check:negative-controls`). Pure math — no network, no keys.

const s = require("../../packages/scoring/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

/** accounts + distribution from {"role/domain[/quality]": count} (Unit 43). */
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
  const tally = (pick) => {
    const counts = {};
    for (const a of accounts) counts[pick(a)] = (counts[pick(a)] ?? 0) + 1;
    const out = {};
    for (const [k, c] of Object.entries(counts)) out[k] = { count: c, share: c / accounts.length };
    return out;
  };
  return {
    accounts,
    distribution: {
      sampleSize: accounts.length,
      roles: tally((a) => a.role),
      domains: tally((a) => a.domain),
      quality: tally((a) => a.quality),
    },
  };
}

const input = (audience, overrides = {}) => ({
  org: {
    productCategory: overrides.orgCategory ?? "DeFi protocol",
    targetUser: "protocol users", keywords: [], confidence: "high",
    targetRoles: overrides.targetRoles ?? { primary: ["enthusiast"], secondary: [] },
    targetDomains: overrides.targetDomains ?? { primary: ["crypto_defi"], secondary: [] },
  },
  content: {
    themes: overrides.themes ?? ["crypto"], verticals: ["crypto"], style: "hype", depth: "low",
    promoPatterns: [], repeatedTickers: [],
    postLabels: overrides.postLabels ?? Array.from({ length: 40 }, (_, i) => ({ postId: `p${i}`, isPromo: false })),
    brandSafetyFlags: overrides.flags ?? [], mediaLabels: [],
  },
  audience,
  sample: { kolPostsSampled: 100, kolRepliesSampled: 50, topPostsAnalyzed: 20, engagedAccountsSampled: 800, engagedAccountsClassified: audience.distribution.sampleSize, repeatEngagerShare: 0 },
  evidence: { websiteFetched: false, docsFetched: false, hasEngagementText: true },
  brief: { campaignGoal: null, region: null, productCategory: null, targetUser: null, stage: null },
  contentFitAssessment: overrides.fit,
  kolPostLangs: Array(100).fill("en"),
});

const promoLabels = (n, promo, related, quality) =>
  Array.from({ length: n }, (_, i) => (i < promo ? { postId: `p${i}`, isPromo: true, promoRelated: related, promoQuality: quality } : { postId: `p${i}`, isPromo: false }));

// --- gate tiers (unit level) ---------------------------------------------------
{
  const none = { paidPromoRisk: 0, botFarmRisk: 0, promoUnrelatedShare: 0, brandSafety: 100 };
  ck("bot 97 caps at AVOID (severe tier)", s.verdictFromScore(90, { ...none, botFarmRisk: 97 }) === "AVOID");
  ck("bot 96 stays WEAK (high tier)", s.verdictFromScore(90, { ...none, botFarmRisk: 96 }) === "WEAK");
  ck("brand safety 39 caps at WEAK", s.verdictFromScore(90, { ...none, brandSafety: 39 }) === "WEAK");
  ck("brand safety 19 caps at AVOID", s.verdictFromScore(90, { ...none, brandSafety: 19 }) === "AVOID");
  ck("brand safety 41 does not gate", s.verdictFromScore(90, { ...none, brandSafety: 41 }) === "STRONG");
  ck("promo 96 + unrelated caps at WEAK (new tier)", s.verdictFromScore(90, { ...none, paidPromoRisk: 96, promoUnrelatedShare: 0.8 }) === "WEAK");
  ck("promo 96 alone NEVER reaches AVOID", s.verdictFromScore(90, { ...none, paidPromoRisk: 100, promoUnrelatedShare: 1 }) !== "AVOID");
  ck("caps combine as minimum", s.verdictFromScore(90, { ...none, botFarmRisk: 86, brandSafety: 19 }) === "AVOID");
}

// --- AVOID controls --------------------------------------------------------------
{
  // 22. Aave × AirdropFarmHub: farm/giveaway-dominated audience.
  const farm = s.scoreAnalysis(input(audienceOf({ "enthusiast/general/giveaway_hunter": 55, "enthusiast/crypto_infra/farmer": 30, "unknown/unknown/bot": 12, "enthusiast/crypto_defi": 3 })));
  ck(`AirdropFarmHub -> AVOID (got ${farm.verdict}, bot risk ${farm.scores.components.bot_farm_risk.value})`, farm.verdict === "AVOID");

  // 23. Ledger × CasinoBonusFeed: gambling + deception flags, decent reach.
  const casino = s.scoreAnalysis(input(audienceOf({ "enthusiast/culture": 70, "trader/crypto_defi": 20, "unknown/unknown/bot": 10 }), {
    flags: [
      { flag: "gambling_promotion", severity: "high", evidence: "feed dominated by offshore casino bonus codes" },
      { flag: "misleading_claims", severity: "high", evidence: "guaranteed-win wagering claims" },
      { flag: "legal_or_regulatory", severity: "medium", evidence: "unlicensed offshore operators, no geo-gating" },
    ],
  }));
  ck(`CasinoBonusFeed -> AVOID via brand-safety gate (got ${casino.verdict}, bs ${casino.scores.components.brand_safety.value})`, casino.verdict === "AVOID" && casino.scores.components.brand_safety.value < 20);

  // 24. EigenLayer × EngagementRaidBot: coordinated fake engagement.
  const raid = s.scoreAnalysis(input(audienceOf({ "unknown/unknown/bot": 75, "enthusiast/general": 15, "enthusiast/crypto_memecoins": 10 }), { targetRoles: { primary: ["developer", "researcher"], secondary: [] }, targetDomains: { primary: ["crypto_infra"], secondary: [] } }));
  ck(`EngagementRaidBot -> AVOID (got ${raid.verdict}, bot risk ${raid.scores.components.bot_farm_risk.value})`, raid.verdict === "AVOID");

  // 25. Phantom × MemeGiveawayHost: wallet-drain giveaways = severe safety.
  const giveaway = s.scoreAnalysis(input(audienceOf({ "enthusiast/general/giveaway_hunter": 45, "enthusiast/crypto_memecoins": 25, "unknown/unknown/bot": 20, "enthusiast/general": 10 }), {
    flags: [
      { flag: "scam_or_rug_association", severity: "high", evidence: "wallet-drain-prone giveaway links" },
      { flag: "impersonation_or_deception", severity: "high", evidence: "fake brand giveaways" },
      { flag: "misleading_claims", severity: "medium", evidence: "reply-to-win token drops" },
    ],
  }));
  ck(`MemeGiveawayHost -> AVOID (got ${giveaway.verdict})`, giveaway.verdict === "AVOID");

  // 26. Polymarket × UnverifiedSportsTips: real category overlap must NOT
  // defeat the cap (rule 14).
  const tips = s.scoreAnalysis(input(audienceOf({ "enthusiast/culture": 60, "trader/crypto_defi": 30, "unknown/unknown/bot": 10 }), {
    fit: { topicalAdjacency: 4, audienceOverlapPotential: 4, naturalMentionFit: 4, sharedTopics: ["prediction markets", "sports"], rationale: "category overlap", relationship: "none", relationshipEvidence: "tips account" },
    flags: [
      { flag: "misleading_claims", severity: "high", evidence: "unverifiable win-rate claims; losing predictions deleted" },
      { flag: "legal_or_regulatory", severity: "high", evidence: "gambling-adjacent referrals without jurisdiction checks" },
      { flag: "gambling_promotion", severity: "medium", evidence: "constant betting referral links" },
    ],
  }));
  ck(`UnverifiedSportsTips -> AVOID despite category overlap (got ${tips.verdict}, CF ${tips.scores.components.content_fit.value})`, tips.verdict === "AVOID" && tips.scores.components.content_fit.value >= 70);

  // v3 has NO founder floor at all — a founder pair with a farm/giveaway
  // audience is just an off-target + gated audience -> AVOID. The relationship
  // field is ignored by scoring; there is nothing to "lose to".
  const founderButSevere = s.scoreAnalysis(input(audienceOf({ "enthusiast/general/giveaway_hunter": 55, "enthusiast/crypto_infra/farmer": 30, "unknown/unknown/bot": 12, "enthusiast/crypto_defi": 3 }), {
    fit: { topicalAdjacency: 5, audienceOverlapPotential: 5, naturalMentionFit: 5, sharedTopics: [], rationale: "founder", relationship: "founder_or_core_team", relationshipEvidence: "bio" },
  }));
  ck(`identity ignored: farm audience -> AVOID even for a "founder" (got ${founderButSevere.verdict})`, founderButSevere.verdict === "AVOID");
}

// --- Off-target controls: audiences that barely contain the target now fall
//     below the 5% floor -> AVOID (v3 removed the old "awareness value" WEAK
//     floor; the PROMO gate alone still never forces AVOID — see gate tiers). --
{
  // 20. chainlink × CryptoMacroSponsor: promo-heavy, but the real driver is a
  // ~0% developer/infra audience -> below the target floor -> AVOID (v3). The
  // promo gate itself never forces AVOID; the audience does.
  const sponsor = s.scoreAnalysis(input(
    audienceOf({ "enthusiast/culture": 45, "trader/crypto_defi": 25, "enthusiast/crypto_memecoins": 15, "unknown/unknown/bot": 10, "investor/crypto_infra": 5 }),
    {
      targetRoles: { primary: ["developer", "researcher"], secondary: ["investor"] },
      targetDomains: { primary: ["crypto_infra"], secondary: [] },
      postLabels: promoLabels(40, 24, false, "ok"),
      fit: { topicalAdjacency: 2, audienceOverlapPotential: 2, naturalMentionFit: 2, sharedTopics: [], rationale: "macro/BTC commentary, not oracle infrastructure", relationship: "none", relationshipEvidence: "large macro account" },
    }
  ));
  ck(`CryptoMacroSponsor -> AVOID (off-target audience, got ${sponsor.verdict}, overall ${sponsor.scores.overall.value})`, sponsor.verdict === "AVOID");
  ck(`AVOID is audience-driven, not the promo gate (promo risk ${sponsor.scores.components.paid_promo_risk.value} < 95)`, sponsor.scores.components.paid_promo_risk.value < 95);

  // 21. base × AltcoinDealsDesk: deal-seeking retail audience vs builder
  // targets -> negligible target share -> AVOID (v3).
  const deals = s.scoreAnalysis(input(
    audienceOf({ "enthusiast/culture": 30, "enthusiast/crypto_memecoins": 25, "trader/crypto_defi": 20, "enthusiast/general/giveaway_hunter": 11, "unknown/unknown/bot": 11, "developer/crypto_infra": 3 }),
    {
      targetRoles: { primary: ["developer", "founder"], secondary: [] },
      targetDomains: { primary: ["crypto_infra"], secondary: [] },
      postLabels: promoLabels(40, 20, false, "low"),
      fit: { topicalAdjacency: 2, audienceOverlapPotential: 2, naturalMentionFit: 2, sharedTopics: [], rationale: "deals/listings content, not building on Base", relationship: "none", relationshipEvidence: "retail deals account" },
    }
  ));
  ck(`AltcoinDealsDesk -> AVOID (builder targets ~absent, got ${deals.verdict}, overall ${deals.scores.overall.value})`, deals.verdict === "AVOID");
}

console.log(`\nNEGATIVE CONTROLS REGRESSION (Unit 41 v3): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
