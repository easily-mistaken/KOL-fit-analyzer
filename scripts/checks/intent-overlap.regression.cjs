// Unit 30 regression: audience intent overlap (v26 rule 4 — category ≠
// intent). Verifies the EAM damp/floor tables, neutrality (3 / unknown),
// the intent-tiered media cap, prompt/schema round-trip, mock determinism,
// and the calibration-shaped end-to-end cases (Aave×hayden-shaped pair drops
// out of STRONG; Nate-shaped pair gets floored up; Sergey-shaped pair with
// neutral intent is untouched).
//
// Run after `pnpm build`:  node scripts/checks/intent-overlap.regression.cjs
// (or `pnpm check:intent-overlap`). Offline — no network, no keys, no DB.

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

const FIT = (intent, relationship = "none") => ({
  topicalAdjacency: 4, audienceOverlapPotential: 4, naturalMentionFit: 4,
  ...(intent === undefined ? {} : { audienceIntentOverlap: intent }),
  sharedTopics: ["defi"], rationale: "x", relationship, relationshipEvidence: "y",
});

const input = (audience, fit, targetBuckets = { primary: ["defi_users"], secondary: [] }) => ({
  org: { productCategory: "DeFi lending", targetUser: "borrowers and lenders", keywords: [], confidence: "high", targetBuckets },
  content: { themes: ["defi"], verticals: ["defi"], promoPatterns: [], repeatedTickers: [], postLabels: [{ postId: "p", isPromo: false }], brandSafetyFlags: [], mediaLabels: [] },
  audience,
  sample: { kolPostsSampled: 100, kolRepliesSampled: 50, topPostsAnalyzed: 20, engagedAccountsSampled: 1000, engagedAccountsClassified: audience.distribution.sampleSize, repeatEngagerShare: 0.1 },
  evidence: { websiteFetched: false, docsFetched: false, hasEngagementText: true },
  brief: { campaignGoal: null, region: null, productCategory: null, targetUser: null, stage: null },
  contentFitAssessment: fit,
  kolPostLangs: Array(100).fill("en"),
});

(async () => {
  // --- 1. schema additive ------------------------------------------------------
  ck("pre-30 assessment (no intent field) still validates", ContentFitAssessmentSchema.safeParse(FIT(undefined)).success);
  ck("intent 6 rejected", !ContentFitAssessmentSchema.safeParse(FIT(6)).success);

  // --- 2. EAM damp / floor / neutral -------------------------------------------
  {
    // 45% category match of 100 humans -> base EAM 88.
    const aud = audienceOf({ defi_users: 45, non_crypto: 55 });
    const eamAt = (fit) => s.scoreAnalysis(input(aud, fit)).scores.components.engaged_audience_match.value;
    const base = eamAt(FIT(undefined));
    ck(`no intent -> unchanged base (${base})`, base === 88);
    ck("intent 3 neutral", eamAt(FIT(3)) === base);
    ck("intent 5 no-op when category already strong", eamAt(FIT(5)) === base);
    ck(`intent 2 damps to half (${eamAt(FIT(2))})`, eamAt(FIT(2)) === 44);
    ck(`intent 1 damps harder (${eamAt(FIT(1))})`, eamAt(FIT(1)) === 35);
    ck("damp explained in reasons", s.scoreAnalysis(input(aud, FIT(2))).scores.components.engaged_audience_match.reasons.some((r) => r.includes("not its user intent")));
  }
  {
    // Nate-shape: audience sits in non-target buckets -> base EAM low; high
    // intent floors it.
    const aud = audienceOf({ non_crypto: 90, traders: 10 });
    const eamAt = (fit) => s.scoreAnalysis(input(aud, fit)).scores.components.engaged_audience_match.value;
    const base = eamAt(FIT(undefined));
    ck(`low category base (${base} < 45)`, base < 45);
    ck("intent 4 floors to 55", eamAt(FIT(4)) === 55);
    ck("intent 5 floors to 70", eamAt(FIT(5)) === 70);
    ck("intent 3 does NOT floor", eamAt(FIT(3)) === base);
    ck("floor explained in reasons", s.scoreAnalysis(input(aud, FIT(5))).scores.components.engaged_audience_match.reasons.some((r) => r.includes("floored")));
  }

  // --- 3. intent-tiered media cap ------------------------------------------------
  {
    const base = { eam: 80, brandSafety: 100, riskGateFired: false, relationship: "media_or_news" };
    const r = (v, ctx) => s.applyAuthorityRules(v, ctx);
    ck("media + intent 2 caps at WEAK (reach without intent)", r("GOOD", { ...base, intentOverlap: 2 }).verdict === "WEAK");
    ck("media + intent 4 + EAM proof caps at GOOD", r("STRONG", { ...base, intentOverlap: 4 }).verdict === "GOOD");
    ck("media + intent 3 caps at OKAY even with EAM proof", r("STRONG", { ...base, intentOverlap: 3 }).verdict === "OKAY");
    ck("media + unknown intent behaves like 29E (EAM tier -> GOOD)", r("STRONG", { ...base }).verdict === "GOOD");
    ck("media cap never raises (WEAK stays WEAK at intent 5)", r("WEAK", { ...base, intentOverlap: 5 }).verdict === "WEAK");
    ck("non-media ignores intent tiers", r("STRONG", { ...base, relationship: "none", intentOverlap: 0 }).applied === null);
  }

  // --- 4. calibration-shaped end-to-end -----------------------------------------
  {
    // Aave×hayden shape: strong category match (DEX audience in defi_users),
    // wrong intent -> must drop out of STRONG to OKAY-band.
    const aud = audienceOf({ defi_users: 50, traders: 15, non_crypto: 35 });
    const wrongIntent = s.scoreAnalysis(input(aud, { ...FIT(2, "adjacent_ecosystem_authority"), topicalAdjacency: 5, audienceOverlapPotential: 5, naturalMentionFit: 5 }));
    const rightIntent = s.scoreAnalysis(input(aud, { ...FIT(5, "adjacent_ecosystem_authority"), topicalAdjacency: 5, audienceOverlapPotential: 5, naturalMentionFit: 5 }));
    ck(`wrong-intent pair leaves STRONG (got ${wrongIntent.verdict} ${wrongIntent.scores.overall.value})`, ["OKAY", "GOOD"].includes(wrongIntent.verdict) && wrongIntent.scores.overall.value < 75);
    ck(`same audience with real intent stays high (got ${rightIntent.verdict})`, ["GOOD", "STRONG"].includes(rightIntent.verdict));
    ck("deterministic", JSON.stringify(s.scoreAnalysis(input(aud, FIT(2)))) === JSON.stringify(s.scoreAnalysis(input(aud, FIT(2)))));
  }

  // --- 5. prompt/schema round-trip + mock -----------------------------------------
  {
    let captured;
    const fetchImpl = async (url, init) => {
      captured = JSON.parse(init.body);
      const out = { ...FIT(1, "media_or_news") };
      return new Response(JSON.stringify({ output_text: JSON.stringify(out), usage: {} }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const p = llm.createOpenAiLlmProvider({ apiKey: "k", model: "m", fetchImpl });
    const res = await p.assessContentFit({ org: { handle: "ledger", classification: { keywords: [], confidence: "high" } }, kol: { handle: "coindesk", content: { themes: [], verticals: [], promoPatterns: [], repeatedTickers: [] }, profile: { id: "u", handle: "coindesk", bio: "news" } } });
    ck("intent round-trips through OpenAI provider", res.audienceIntentOverlap === 1);
    ck("strict schema requires audienceIntentOverlap", captured.text.format.schema.required.includes("audienceIntentOverlap"));
    const user = typeof captured.input[1].content === "string" ? captured.input[1].content : captured.input[1].content[0].text;
    ck("prompt carries the rule-4 contrasts", user.includes("NEWS READERS") && user.includes("mainstream gamers"));
    const mock = llm.createMockLlmProvider();
    const m = await mock.assessContentFit({ org: { handle: "a", classification: { productCategory: "defi", keywords: ["defi"], confidence: "low" } }, kol: { handle: "k", content: { themes: ["defi"], verticals: ["defi"], promoPatterns: [], repeatedTickers: [] } } });
    ck("mock emits in-range intent", Number.isInteger(m.audienceIntentOverlap) && m.audienceIntentOverlap >= 0 && m.audienceIntentOverlap <= 5);
  }

  // --- 6. fit-model tiering (LLM_MODEL_FIT) ---------------------------------------
  {
    const models = [];
    const fetchImpl = async (url, init) => {
      const body = JSON.parse(init.body);
      models.push({ method: body.text.format.name, model: body.model, effort: body.reasoning?.effort });
      const out = body.text.format.name === "content_fit" ? FIT(3) : { productCategory: null, targetUser: null, stage: null, campaignGoal: null, region: null, keywords: [], targetBuckets: { primary: [], secondary: [] }, confidence: "low" };
      return new Response(JSON.stringify({ output_text: JSON.stringify(out), usage: {} }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const p = llm.createOpenAiLlmProvider({ apiKey: "k", model: "main-x", fitModel: "strong-x", fetchImpl });
    await p.classifyOrgProfile({ handle: "a", profile: null });
    await p.assessContentFit({ org: { handle: "a", classification: { keywords: [], confidence: "low" } }, kol: { handle: "k", content: { themes: [], verticals: [], promoPatterns: [], repeatedTickers: [] } } });
    ck("fit call runs on the fit tier", models.find((m) => m.method === "content_fit").model === "strong-x");
    ck("other calls stay on the main model", models.find((m) => m.method === "org_classification").model === "main-x");
    ck("fitModel exposed for cache keying", p.fitModel === "strong-x");
    ck("fit call sends elevated reasoning effort (low)", models.find((m) => m.method === "content_fit").effort === "low");
    ck("bulk calls keep the default effort (minimal)", models.find((m) => m.method === "org_classification").effort === "minimal");
  }

  console.log(`\nINTENT OVERLAP REGRESSION (30): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
