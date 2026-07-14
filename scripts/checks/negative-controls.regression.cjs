// Unit 29G regression: severity-tiered risk caps + the v26 SYNTHETIC negative
// controls (context/krypto-kol-calibration-pairs-v26.md, rule 14). The seven
// synthetic pairs are PATTERNS, not real accounts — encoded here as scoring
// fixtures (the live calibration runner skips them). Verifies: severe risk
// caps to AVOID; keyword/category overlap does not defeat caps; promo-heavy
// is WEAK, not auto-AVOID; founder authority loses to severe risk; caps
// combine as the minimum.
//
// Run after `pnpm build`:  node scripts/checks/negative-controls.regression.cjs
// (or `pnpm check:negative-controls`). Pure math — no network, no keys.

const s = require("../../packages/scoring/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

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

const input = (audience, overrides = {}) => ({
  org: {
    productCategory: overrides.orgCategory ?? "DeFi protocol",
    targetUser: "protocol users", keywords: [], confidence: "high",
    targetBuckets: overrides.targetBuckets ?? { primary: ["defi_users"], secondary: [] },
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
  const farm = s.scoreAnalysis(input(audienceOf({ giveaway_hunters: 55, airdrop_farmers: 30, bots_spam: 12, defi_users: 3 })));
  ck(`AirdropFarmHub -> AVOID (got ${farm.verdict}, bot risk ${farm.scores.components.bot_farm_risk.value})`, farm.verdict === "AVOID");

  // 23. Ledger × CasinoBonusFeed: gambling + deception flags, decent reach.
  const casino = s.scoreAnalysis(input(audienceOf({ non_crypto: 70, traders: 20, bots_spam: 10 }), {
    flags: [
      { flag: "gambling_promotion", severity: "high", evidence: "feed dominated by offshore casino bonus codes" },
      { flag: "misleading_claims", severity: "high", evidence: "guaranteed-win wagering claims" },
      { flag: "legal_or_regulatory", severity: "medium", evidence: "unlicensed offshore operators, no geo-gating" },
    ],
  }));
  ck(`CasinoBonusFeed -> AVOID via brand-safety gate (got ${casino.verdict}, bs ${casino.scores.components.brand_safety.value})`, casino.verdict === "AVOID" && casino.scores.components.brand_safety.value < 20);

  // 24. EigenLayer × EngagementRaidBot: coordinated fake engagement.
  const raid = s.scoreAnalysis(input(audienceOf({ bots_spam: 75, non_crypto: 15, meme_degens: 10 }), { targetBuckets: { primary: ["developers", "infra_research"], secondary: [] } }));
  ck(`EngagementRaidBot -> AVOID (got ${raid.verdict}, bot risk ${raid.scores.components.bot_farm_risk.value})`, raid.verdict === "AVOID");

  // 25. Phantom × MemeGiveawayHost: wallet-drain giveaways = severe safety.
  const giveaway = s.scoreAnalysis(input(audienceOf({ giveaway_hunters: 45, meme_degens: 25, bots_spam: 20, non_crypto: 10 }), {
    flags: [
      { flag: "scam_or_rug_association", severity: "high", evidence: "wallet-drain-prone giveaway links" },
      { flag: "impersonation_or_deception", severity: "high", evidence: "fake brand giveaways" },
      { flag: "misleading_claims", severity: "medium", evidence: "reply-to-win token drops" },
    ],
  }));
  ck(`MemeGiveawayHost -> AVOID (got ${giveaway.verdict})`, giveaway.verdict === "AVOID");

  // 26. Polymarket × UnverifiedSportsTips: real category overlap must NOT
  // defeat the cap (rule 14).
  const tips = s.scoreAnalysis(input(audienceOf({ non_crypto: 60, traders: 30, bots_spam: 10 }), {
    fit: { topicalAdjacency: 4, audienceOverlapPotential: 4, naturalMentionFit: 4, sharedTopics: ["prediction markets", "sports"], rationale: "category overlap", relationship: "none", relationshipEvidence: "tips account" },
    flags: [
      { flag: "misleading_claims", severity: "high", evidence: "unverifiable win-rate claims; losing predictions deleted" },
      { flag: "legal_or_regulatory", severity: "high", evidence: "gambling-adjacent referrals without jurisdiction checks" },
      { flag: "gambling_promotion", severity: "medium", evidence: "constant betting referral links" },
    ],
  }));
  ck(`UnverifiedSportsTips -> AVOID despite category overlap (got ${tips.verdict}, CF ${tips.scores.components.content_fit.value})`, tips.verdict === "AVOID" && tips.scores.components.content_fit.value >= 70);

  // Founder authority must LOSE to severe risk (rule 1 escape hatch).
  const founderButSevere = s.scoreAnalysis(input(audienceOf({ giveaway_hunters: 55, airdrop_farmers: 30, bots_spam: 12, defi_users: 3 }), {
    fit: { topicalAdjacency: 5, audienceOverlapPotential: 5, naturalMentionFit: 5, sharedTopics: [], rationale: "founder", relationship: "founder_or_core_team", relationshipEvidence: "bio" },
  }));
  ck(`founder floor loses to severe risk (got ${founderButSevere.verdict})`, founderButSevere.verdict === "AVOID");
}

// --- WEAK controls (promo-heavy / off-target ≠ AVOID) ---------------------------
{
  // 20. chainlink × CryptoMacroSponsor: promo-heavy but disclosed — WEAK via
  // low developer intent, NOT capped to AVOID.
  const sponsor = s.scoreAnalysis(input(
    audienceOf({ non_crypto: 45, traders: 25, meme_degens: 15, bots_spam: 10, investors_vcs: 5 }),
    {
      targetBuckets: { primary: ["developers", "infra_research"], secondary: ["investors_vcs"] },
      postLabels: promoLabels(40, 24, false, "ok"),
      fit: { topicalAdjacency: 2, audienceOverlapPotential: 2, naturalMentionFit: 2, sharedTopics: [], rationale: "macro/BTC commentary, not oracle infrastructure", relationship: "none", relationshipEvidence: "large macro account" },
    }
  ));
  ck(`CryptoMacroSponsor -> WEAK (got ${sponsor.verdict}, overall ${sponsor.scores.overall.value})`, sponsor.verdict === "WEAK");
  ck(`promo-heavy is NOT auto-AVOID (promo risk ${sponsor.scores.components.paid_promo_risk.value})`, sponsor.verdict !== "AVOID" && sponsor.scores.components.paid_promo_risk.value < 95);

  // 21. base × AltcoinDealsDesk: deal-seeking retail vs builder targets.
  const deals = s.scoreAnalysis(input(
    audienceOf({ non_crypto: 30, meme_degens: 25, traders: 20, giveaway_hunters: 11, bots_spam: 11, developers: 3 }),
    {
      targetBuckets: { primary: ["developers", "founders"], secondary: [] },
      postLabels: promoLabels(40, 20, false, "low"),
      fit: { topicalAdjacency: 2, audienceOverlapPotential: 2, naturalMentionFit: 2, sharedTopics: [], rationale: "deals/listings content, not building on Base", relationship: "none", relationshipEvidence: "retail deals account" },
    }
  ));
  ck(`AltcoinDealsDesk -> WEAK (got ${deals.verdict}, overall ${deals.scores.overall.value})`, deals.verdict === "WEAK");
}

console.log(`\nNEGATIVE CONTROLS REGRESSION (29G): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
