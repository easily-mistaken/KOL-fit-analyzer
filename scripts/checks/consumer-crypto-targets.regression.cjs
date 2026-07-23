// Unit 52 regression: consumer/retail crypto target inference. A brand hands us
// only its handle; the product must infer WHO it wants itself. The failure this
// guards: a prediction market / exchange was being read as targeting
// "sophisticated" or institutional investors, so an enthusiast/trader-heavy
// crypto creator (the exact audience such a product wants) scored WEAK. Two
// halves:
//   1) the ORG PROMPT teaches the model to target the retail participant
//      (trader + enthusiast across crypto domains) for consumer crypto apps and
//      NOT to default trading-sounding brands to institutional investors;
//   2) the SCORING already rewards those targets — proven here by scoring one
//      Ansem-shaped audience against the corrected (consumer) targets vs the old
//      mis-scoped (institutional) targets and asserting the bands separate.
//
// Run after `pnpm build`:  node scripts/checks/consumer-crypto-targets.regression.cjs
// (or `pnpm check:consumer-crypto-targets`). Pure — no network, no keys, no DB.

const s = require("../../packages/scoring/dist/index.js");
const { buildOrgPrompt } = require("../../packages/llm/dist/openai/prompts.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

// --- fixture helpers (mirrors scoring-v3.regression.cjs) ---------------------

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

const baseInput = (audience, org) => ({
  org: { keywords: [], confidence: "high", ...org },
  content: {
    themes: ["memecoins", "trading"], verticals: ["memecoins"], style: "hype", depth: "low",
    promoPatterns: [], repeatedTickers: [],
    postLabels: Array.from({ length: 40 }, (_, i) => ({ postId: `p${i}`, isPromo: false })),
    brandSafetyFlags: [], mediaLabels: [],
  },
  audience,
  sample: { kolPostsSampled: 100, kolRepliesSampled: 50, topPostsAnalyzed: 20, engagedAccountsSampled: 1500, engagedAccountsClassified: audience.distribution.sampleSize, repeatEngagerShare: 0.1 },
  evidence: { websiteFetched: false, docsFetched: false, hasEngagementText: true },
  brief: { campaignGoal: null, region: null, productCategory: null, targetUser: null, stage: null },
  contentFitAssessment: undefined,
  kolPostLangs: Array(100).fill("en"),
});

// --- 1. the org prompt actually TEACHES consumer/retail targeting ------------
// A prompt-content guard: if a future edit drops this guidance, the model
// silently reverts to the institutional-default bug. Asserted on the load-
// bearing tokens, not exact prose.
{
  const prompt = buildOrgPrompt({ handle: "jup_predict", profile: null, manualBrief: {} });
  const has = (re) => re.test(prompt);
  ck("org prompt names consumer/retail apps", /consumer\s*\/\s*retail|CONSUMER \/ RETAIL/i.test(prompt));
  ck("org prompt names prediction markets/exchanges as the pattern", /prediction market/i.test(prompt) && /exchange/i.test(prompt));
  ck("org prompt makes trader+enthusiast the retail target", /trader/i.test(prompt) && /enthusiast/i.test(prompt) && /retail participant/i.test(prompt));
  ck("org prompt warns off the institutional default", /institutional/i.test(prompt) && /not investor alone|not investor/i.test(prompt));
  ck("org prompt keeps the builder carve-out (developer example still applies)", /developer platforms|sell to professionals or builders/i.test(prompt));
}

// --- 2. one Ansem-shaped audience, two targets: the bands must separate ------
// Enthusiast/trader-heavy, crypto-native (memecoins/defi), realistic junk +
// off-target tail. This is the @blknoiz06-vs-@jup_predict shape.
const ANSEM = audienceOf({
  "enthusiast/crypto_memecoins": 30,        // degens (the "in your world" crowd)
  "enthusiast/crypto_defi": 16,
  "trader/crypto_memecoins": 9,
  "trader/crypto_defi": 4,
  "enthusiast/crypto_memecoins/farmer": 5,  // real people, discounted (0.5)
  "creator/crypto_memecoins": 13,           // off-target role for a prediction market
  "operator/crypto_infra": 10,              // off-target role
  "enthusiast/general": 14,                 // crypto-adjacent but no niche
  "enthusiast/ai": 4,                       // off-domain
  "unknown/unknown/bot": 8,                 // junk (out of the human denominator)
  "unknown/unknown/giveaway_hunter": 9,     // junk
});

// The CORRECTED read (Unit 52): a prediction market targets the retail crowd.
const CONSUMER_ORG = {
  productCategory: "prediction market", targetUser: "crypto traders and speculators",
  targetRoles: { primary: ["trader", "enthusiast"], secondary: ["investor"] },
  targetDomains: { primary: ["crypto_defi", "crypto_memecoins"], secondary: ["crypto_infra", "crypto_nft_gaming"] },
};
// The OLD mis-scoped read: "sophisticated / institutional" investors.
const INSTITUTIONAL_ORG = {
  productCategory: "derivatives / prediction market", targetUser: "sophisticated investors",
  targetRoles: { primary: ["investor", "trader"], secondary: ["founder"] },
  targetDomains: { primary: ["finance"], secondary: ["crypto_defi"] },
};

const consumer = s.scoreAnalysis(baseInput(ANSEM, CONSUMER_ORG));
const institutional = s.scoreAnalysis(baseInput(ANSEM, INSTITUTIONAL_ORG));

ck(`consumer target: NOT weak (got ${consumer.verdict}, overall ${consumer.scores.overall.value})`,
  ["GOOD", "STRONG"].includes(consumer.verdict) && consumer.scores.overall.value >= 70);
ck(`consumer target: enthusiasts now count (EAM ${consumer.scores.components.engaged_audience_match.value} >= 70)`,
  consumer.scores.components.engaged_audience_match.value >= 70);
ck(`institutional target: poor band, as before the fix (got ${institutional.verdict}, overall ${institutional.scores.overall.value})`,
  institutional.scores.overall.value < 50);
ck(`same audience, targets decide the score: consumer beats institutional by >= 30 (${consumer.scores.overall.value} vs ${institutional.scores.overall.value})`,
  consumer.scores.overall.value - institutional.scores.overall.value >= 30);

// The whole thesis in one line: reach did not change, the READ of who the brand
// wants did. No identity/relationship modifier is involved either way.
ck("consumer verdict is driven by the audience match alone (overall == EAM, no activity/originality data)",
  consumer.scores.overall.value === consumer.scores.components.engaged_audience_match.value);

// --- 3. the fix does NOT flatten discrimination -----------------------------
// A genuine builder product (developers in AI) must STILL reject this
// memecoin-degen audience — the carve-out has to hold or the metric is noise.
{
  const devtool = s.scoreAnalysis(baseInput(ANSEM, {
    productCategory: "developer platform", targetUser: "smart-contract developers",
    targetRoles: { primary: ["developer", "researcher"], secondary: ["founder"] },
    targetDomains: { primary: ["crypto_infra", "software"], secondary: ["ai"] },
  }));
  ck(`builder product still rejects a degen audience (got ${devtool.verdict}, overall ${devtool.scores.overall.value} < 50)`,
    devtool.scores.overall.value < 50);
}

console.log(`\nCONSUMER-CRYPTO TARGETS REGRESSION (Unit 52): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
