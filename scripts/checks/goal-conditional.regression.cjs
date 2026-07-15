// Unit 32 regression: goal-conditional verdicts + official_ecosystem_lead.
// Verifies (1) the new relationship class (schema, prompt, mock, floor+boost),
// (2) the adjacent-authority cap under the default goal and its lift under
// awareness/credibility goals, (3) the awareness-softened media WEAK tier,
// and (4) goal-conditional official-lead boost (no boost under awareness).
//
// Run after `pnpm build`:  node scripts/checks/goal-conditional.regression.cjs
// (or `pnpm check:goal-conditional`). Offline — no network, no keys, no DB.

const s = require("../../packages/scoring/dist/index.js");
const llm = require("../../packages/llm/dist/index.js");
const { ContentFitAssessmentSchema } = require("../../packages/shared/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

function audienceOf(bucketCounts) {
  const accounts = [];
  let i = 0;
  for (const [bucket, count] of Object.entries(bucketCounts)) {
    for (let k = 0; k < count; k++) {
      accounts.push({ accountId: `a${i}`, handle: `h${i++}`, source: "REPLY", bucket, signals: { botScore: 0.1, emptyBio: false, farmingSignals: [] } });
    }
  }
  const buckets = {};
  for (const [bucket, count] of Object.entries(bucketCounts)) buckets[bucket] = { count, share: count / accounts.length };
  return { accounts, distribution: { sampleSize: accounts.length, buckets } };
}

const FIT = (relationship) => ({ topicalAdjacency: 5, audienceOverlapPotential: 5, naturalMentionFit: 5, audienceIntentOverlap: 5, sharedTopics: ["defi"], rationale: "x", relationship, relationshipEvidence: "y" });

// Strong-metrics fixture: 50% target match -> base overall in the high 80s.
const input = (relationship, campaignGoal = null) => ({
  org: { productCategory: "DeFi", targetUser: "traders", keywords: [], confidence: "high", targetBuckets: { primary: ["defi_users"], secondary: [] } },
  content: { themes: ["defi"], verticals: ["defi"], promoPatterns: [], repeatedTickers: [], postLabels: [{ postId: "p", isPromo: false }], brandSafetyFlags: [], mediaLabels: [] },
  audience: audienceOf({ defi_users: 50, non_crypto: 50 }),
  sample: { kolPostsSampled: 100, kolRepliesSampled: 50, topPostsAnalyzed: 20, engagedAccountsSampled: 500, engagedAccountsClassified: 100, repeatEngagerShare: 0.1 },
  evidence: { websiteFetched: false, docsFetched: false, hasEngagementText: true },
  brief: { campaignGoal, region: null, productCategory: null, targetUser: null, stage: null },
  contentFitAssessment: FIT(relationship),
  kolPostLangs: ["en"],
});

(async () => {
  // --- 1. schema/enum additive ---------------------------------------------------
  ck("official_ecosystem_lead accepted by shared schema", ContentFitAssessmentSchema.safeParse(FIT("official_ecosystem_lead")).success);
  ck("pre-32 relationships still validate", ContentFitAssessmentSchema.safeParse(FIT("adjacent_ecosystem_authority")).success);

  // --- 2. adjacent cap: default goal vs exempt goals -------------------------------
  {
    const adjacentDefault = s.scoreAnalysis(input("adjacent_ecosystem_authority"));
    ck(`adjacent capped at GOOD under default goal (got ${adjacentDefault.verdict}, overall ${adjacentDefault.scores.overall.value})`, adjacentDefault.verdict === "GOOD" && adjacentDefault.scores.overall.value >= 83);
    ck("adjacent cap explained in reasons", adjacentDefault.scores.overall.reasons.some((r) => r.includes("Adjacent-authority cap")));
    const adjacentAwareness = s.scoreAnalysis(input("adjacent_ecosystem_authority", "awareness"));
    ck(`awareness goal lifts the adjacent cap (got ${adjacentAwareness.verdict})`, adjacentAwareness.verdict === "STRONG");
    const adjacentCred = s.scoreAnalysis(input("adjacent_ecosystem_authority", "investor_credibility"));
    ck(`credibility goal lifts the adjacent cap (got ${adjacentCred.verdict})`, adjacentCred.verdict === "STRONG");
    const adjacentAcq = s.scoreAnalysis(input("adjacent_ecosystem_authority", "user_acquisition"));
    ck("product goal keeps the cap", adjacentAcq.verdict === "GOOD");
  }

  // --- 3. official_ecosystem_lead: founder-grade, goal-conditional boost ----------
  {
    const lead = s.scoreAnalysis(input("official_ecosystem_lead"));
    const none = s.scoreAnalysis(input("none"));
    ck(`official lead gets the +6 boost (${none.scores.overall.value} -> ${lead.scores.overall.value})`, lead.scores.overall.value === none.scores.overall.value + 6);
    ck(`official lead can be STRONG (got ${lead.verdict})`, lead.verdict === "STRONG");
    const leadAwareness = s.scoreAnalysis(input("official_ecosystem_lead", "awareness"));
    ck("no boost under a retail awareness goal", leadAwareness.scores.overall.value === s.scoreAnalysis(input("none", "awareness")).scores.overall.value);
    // Floor: weak metrics + official lead -> GOOD floor (like founder).
    const weakAud = audienceOf({ defi_users: 8, non_crypto: 92 });
    const weakLead = s.scoreAnalysis({ ...input("official_ecosystem_lead"), audience: weakAud, contentFitAssessment: { ...FIT("official_ecosystem_lead"), topicalAdjacency: 2, audienceOverlapPotential: 2, naturalMentionFit: 2, audienceIntentOverlap: 3 } });
    ck(`official lead gets the founder floor (got ${weakLead.verdict})`, weakLead.verdict === "GOOD");
  }

  // --- 4. media WEAK tier softens under awareness ----------------------------------
  {
    const base = { eam: 60, brandSafety: 100, riskGateFired: false, relationship: "media_or_news", intentOverlap: 2 };
    ck("media + low intent caps WEAK under default goal", s.applyAuthorityRules("GOOD", base).verdict === "WEAK");
    ck("media + low intent caps OKAY under awareness goal", s.applyAuthorityRules("GOOD", { ...base, goalKey: "awareness" }).verdict === "OKAY");
    ck("awareness does not lift the media GOOD ceiling", s.applyAuthorityRules("STRONG", { eam: 80, brandSafety: 100, riskGateFired: false, relationship: "media_or_news", intentOverlap: 5, goalKey: "awareness" }).verdict === "GOOD");
  }

  // --- 5. prompt/mock ---------------------------------------------------------------
  {
    let captured;
    const fetchImpl = async (url, init) => {
      captured = JSON.parse(init.body);
      return new Response(JSON.stringify({ output_text: JSON.stringify(FIT("official_ecosystem_lead")), usage: {} }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const p = llm.createOpenAiLlmProvider({ apiKey: "k", model: "m", fetchImpl });
    const res = await p.assessContentFit({ org: { handle: "base", classification: { keywords: [], confidence: "high" } }, kol: { handle: "jesse", content: { themes: [], verticals: [], promoPatterns: [], repeatedTickers: [] }, profile: { id: "u", handle: "jesse", bio: "@base builder #001" } } });
    ck("official_ecosystem_lead round-trips", res.relationship === "official_ecosystem_lead");
    const user = typeof captured.input[1].content === "string" ? captured.input[1].content : captured.input[1].content[0].text;
    ck("prompt defines the new class", user.includes("official_ecosystem_lead") && user.includes("CREATOR, lead, or official operator"));
    ck("strict schema enum includes the new class", captured.text.format.schema.properties.relationship.enum.includes("official_ecosystem_lead"));
    const mock = llm.createMockLlmProvider();
    const m = await mock.assessContentFit({ org: { handle: "immutable", classification: { keywords: [], confidence: "low" } }, kol: { handle: "j", content: { themes: [], verticals: [], promoPatterns: [], repeatedTickers: [] }, profile: { id: "u", handle: "j", bio: "Creator of somechain, head of protocols at BigCo" } } });
    ck("mock classifies creator-of bios as official lead", m.relationship === "official_ecosystem_lead");
  }

  console.log(`\nGOAL CONDITIONAL REGRESSION (32): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
