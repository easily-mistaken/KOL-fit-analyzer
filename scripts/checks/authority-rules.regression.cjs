// Unit 29F regression: relationship-aware verdicts. Verifies (1) the additive
// relationship fields on the content-fit assessment, (2) the OpenAI prompt/
// schema carry the KOL bio + relationship categories, (3) the fit cache key is
// profile-sensitive, (4) mock relationship rules (founder vs adjacent vs media
// vs specialist vs none), and (5) the scoring authority rules: founder floor
// (and when it must NOT apply), media cap (and its EAM exemption), and that
// adjacent authority gets no floor.
//
// Run after `pnpm build`:  node scripts/checks/authority-rules.regression.cjs
// (or `pnpm check:authority-rules`). Offline — no network, no keys.

const llm = require("../../packages/llm/dist/index.js");
const cache = require("../../packages/cache/dist/index.js");
const s = require("../../packages/scoring/dist/index.js");
const { ContentFitAssessmentSchema } = require("../../packages/shared/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

const FIT = { topicalAdjacency: 5, audienceOverlapPotential: 5, naturalMentionFit: 5, sharedTopics: ["defi"], rationale: "same domain" };

(async () => {
  // --- 1. schema additive ------------------------------------------------------
  ck("pre-29F assessment (no relationship) still validates", ContentFitAssessmentSchema.safeParse(FIT).success);
  ck("relationship enum accepted", ContentFitAssessmentSchema.safeParse({ ...FIT, relationship: "founder_or_core_team", relationshipEvidence: "bio" }).success);
  ck("unknown relationship rejected", !ContentFitAssessmentSchema.safeParse({ ...FIT, relationship: "bestie" }).success);

  // --- 2. OpenAI prompt/schema -------------------------------------------------
  {
    let captured;
    const fetchImpl = async (url, init) => {
      captured = JSON.parse(init.body);
      const out = { ...FIT, relationship: "adjacent_ecosystem_authority", relationshipEvidence: "chain co-founder, not org team" };
      return new Response(JSON.stringify({ output_text: JSON.stringify(out), usage: {} }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const p = llm.createOpenAiLlmProvider({ apiKey: "k", model: "m", fetchImpl });
    const res = await p.assessContentFit({
      org: { handle: "uniswap", classification: { keywords: [], confidence: "high" } },
      kol: { handle: "vitalik", content: { themes: [], verticals: [], promoPatterns: [], repeatedTickers: [] }, profile: { id: "u1", handle: "vitalik", bio: "Ethereum co-founder" } },
    });
    ck("relationship round-trips through OpenAI provider", res.relationship === "adjacent_ecosystem_authority");
    const user = typeof captured.input[1].content === "string" ? captured.input[1].content : captured.input[1].content[0].text;
    ck("prompt carries the KOL bio", user.includes("Ethereum co-founder"));
    ck("prompt defines all five relationship categories", ["founder_or_core_team", "adjacent_ecosystem_authority", "independent_specialist", "media_or_news", "none"].every((k) => user.includes(k)));
    ck("strict schema requires relationship fields", captured.text.format.schema.required.includes("relationship") && captured.text.format.schema.required.includes("relationshipEvidence"));
  }

  // --- 3. fit cache key is profile-sensitive -----------------------------------
  {
    let calls = 0;
    const inner = {
      model: "m",
      async assessContentFit() { calls++; return FIT; },
      async classifyOrgProfile() {}, async classifyKolContent() {}, async classifyAudienceAccounts() {}, async generateFitReport() {},
    };
    const p = cache.withLlmCache(inner, new cache.InMemoryCacheStore(), { enabled: true, ttls: { orgSeconds: 60, contentSeconds: 60, audienceSeconds: 60 } });
    const base = { org: { handle: "a", classification: { keywords: [], confidence: "low" } }, kol: { handle: "k", content: { themes: [], verticals: [], promoPatterns: [], repeatedTickers: [] } } };
    await p.assessContentFit({ ...base, kol: { ...base.kol, profile: { id: "u1", handle: "k", bio: "founder of a" } } });
    await p.assessContentFit({ ...base, kol: { ...base.kol, profile: { id: "u1", handle: "k", bio: "just a guy" } } });
    ck("different bio -> different fit cache key (2 inner calls)", calls === 2);
  }

  // --- 4. mock relationship rules ------------------------------------------------
  {
    const mock = llm.createMockLlmProvider();
    const content = { themes: ["defi"], verticals: ["defi"], promoPatterns: [], repeatedTickers: [] };
    const assess = (orgHandle, bio) => mock.assessContentFit({ org: { handle: orgHandle, classification: { keywords: [], confidence: "low" } }, kol: { handle: "k", content, profile: bio === null ? null : { id: "u", handle: "k", bio } } });
    ck("founder terms + org mention -> founder_or_core_team", (await assess("uniswap", "Inventor of the uniswap protocol")).relationship === "founder_or_core_team");
    ck("founder terms w/o org mention -> adjacent", (await assess("phantom", "Co-founder of Solana")).relationship === "adjacent_ecosystem_authority");
    ck("news bio -> media_or_news", (await assess("uniswap", "Breaking crypto news and media")).relationship === "media_or_news");
    ck("investigator bio -> independent_specialist", (await assess("ledger", "Onchain investigator. Scam research.")).relationship === "independent_specialist");
    ck("plain bio -> none", (await assess("uniswap", "I like turtles and charts")).relationship === "none");
    ck("no profile -> none with evidence", (await assess("uniswap", null)).relationship === "none");
  }

  // --- 5. authority rules in scoring ---------------------------------------------
  {
    const base = { eam: 40, brandSafety: 100, riskGateFired: false };
    const r = (v, ctx) => s.applyAuthorityRules(v, ctx);
    ck("founder floor raises WEAK -> GOOD", r("WEAK", { ...base, relationship: "founder_or_core_team" }).verdict === "GOOD");
    ck("founder floor never lowers STRONG", r("STRONG", { ...base, relationship: "founder_or_core_team" }).verdict === "STRONG");
    ck("founder floor yields to a fired risk gate", r("WEAK", { ...base, relationship: "founder_or_core_team", riskGateFired: true }).applied === null);
    ck("founder floor yields to severe brand safety", r("WEAK", { ...base, relationship: "founder_or_core_team", brandSafety: 40 }).applied === null);
    ck("media cap lowers GOOD -> OKAY when EAM below exemption", r("GOOD", { ...base, relationship: "media_or_news", eam: 50 }).verdict === "OKAY");
    ck("media cap exempted by high EAM (audience proof)", r("STRONG", { ...base, relationship: "media_or_news", eam: 80 }).applied === null);
    ck("media cap never raises WEAK", r("WEAK", { ...base, relationship: "media_or_news", eam: 10 }).verdict === "WEAK");
    ck("adjacent authority gets no floor", r("OKAY", { ...base, relationship: "adjacent_ecosystem_authority" }).applied === null);
    ck("specialist gets no floor/cap", r("GOOD", { ...base, relationship: "independent_specialist" }).applied === null);
    ck("no relationship -> untouched", r("GOOD", { ...base }).applied === null);
  }

  // --- 6. end-to-end through scoreAnalysis ----------------------------------------
  {
    const audience = (() => {
      const accounts = [];
      for (let i = 0; i < 100; i++) accounts.push({ accountId: `a${i}`, handle: `h${i}`, source: "REPLY", bucket: i < 8 ? "defi_users" : "non_crypto", signals: { botScore: 0.1, emptyBio: false, farmingSignals: [] } });
      return { accounts, distribution: { sampleSize: 100, buckets: { defi_users: { count: 8, share: 0.08 }, non_crypto: { count: 92, share: 0.92 } } } };
    })();
    const MEDIOCRE_FIT = { ...FIT, topicalAdjacency: 2, audienceOverlapPotential: 2, naturalMentionFit: 2 };
    const input = {
      org: { productCategory: "DeFi / AMM", targetUser: "traders", keywords: [], confidence: "high", targetBuckets: { primary: ["defi_users"], secondary: [] } },
      content: { themes: ["defi"], verticals: ["defi"], promoPatterns: [], repeatedTickers: [], postLabels: [{ postId: "p", isPromo: false }], brandSafetyFlags: [], mediaLabels: [] },
      audience,
      sample: { kolPostsSampled: 100, kolRepliesSampled: 50, topPostsAnalyzed: 20, engagedAccountsSampled: 500, engagedAccountsClassified: 100, repeatEngagerShare: 0 },
      evidence: { websiteFetched: false, docsFetched: false, hasEngagementText: true },
      brief: { campaignGoal: null, region: null, productCategory: null, targetUser: null, stage: null },
      contentFitAssessment: { ...MEDIOCRE_FIT, relationship: "founder_or_core_team", relationshipEvidence: "Bio: founder of the org." },
      kolPostLangs: ["en"],
    };
    const withFloor = s.scoreAnalysis(input);
    const without = s.scoreAnalysis({ ...input, contentFitAssessment: { ...MEDIOCRE_FIT, relationship: "none" } });
    ck(`founder floor lifts a mediocre-audience founder pair (${without.verdict} -> ${withFloor.verdict})`, ["OKAY", "WEAK"].includes(without.verdict) && withFloor.verdict === "GOOD");
    ck("floor is explained in overall reasons", withFloor.scores.overall.reasons.some((x) => x.includes("authority floor")));
    ck("relationship surfaced in reasons", withFloor.scores.overall.reasons.some((x) => x.includes("founder or core team")));
  }

  console.log(`\nAUTHORITY RULES REGRESSION (29F): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
