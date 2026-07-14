// Unit 29B regression: LLM classification v2. Verifies (1) additive schemas,
// (2) org targetBuckets round-trip, (3) KOL content per-post labels + safety
// flags + media labels with image parts attached (capped), (4) audience prompt
// carries 29A reply text + profile stats, (5) audience batches run concurrently
// on the fast model, input-ordered, (6) the assessContentFit rubric (incl.
// repair on out-of-range), (7) mock determinism for all new fields, and
// (8) cls:v2 cache behavior (fit cached, audience key text-sensitive).
//
// Run after `pnpm build`:  node scripts/checks/classification-v2.regression.cjs
// (or `pnpm check:classification-v2`). Injected fetch — no network, no keys.

const llm = require("../../packages/llm/dist/index.js");
const cache = require("../../packages/cache/dist/index.js");
const {
  OrgClassificationSchema,
  KolContentClassificationSchema,
  ContentFitAssessmentSchema,
} = require("../../packages/shared/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ORG_OUT = {
  productCategory: "DeFi / AMM", targetUser: "LPs and traders", stage: "mature",
  campaignGoal: "user_acquisition", region: null, keywords: ["amm", "swap"],
  targetBuckets: { primary: ["defi_users", "traders"], secondary: ["developers"] },
  confidence: "high",
};
const KOL_OUT = {
  themes: ["defi"], verticals: ["defi"], style: "analytical", depth: "high",
  promoPatterns: [], repeatedTickers: [],
  postLabels: [
    { postId: "p1", isPromo: false, promoRelated: null, promoQuality: null },
    { postId: "p2", isPromo: true, promoRelated: true, promoQuality: "ok" },
  ],
  brandSafetyFlags: [
    { flag: "excessive_drama", severity: "low", evidence: "feud thread p2" },
  ],
  mediaLabels: [{ postId: "p1", kind: "chart_or_data" }],
};
const FIT_OUT = {
  topicalAdjacency: 4, audienceOverlapPotential: 5, naturalMentionFit: 4,
  sharedTopics: ["defi"], rationale: "Same domain.",
};
const audienceOut = (n) => ({
  accounts: Array.from({ length: n }, () => ({
    accountId: null, handle: null, source: "REPLY", bucket: "developers",
    signals: { botScore: 0.1, emptyBio: false, farmingSignals: [] },
  })),
});

// Request-inspecting fetch. Routes on the structured-output schema name.
function makeFetch(state, opts = {}) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    const name = body.text.format.name;
    state.requests.push(body);
    state.inFlight++;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    await sleep(15);
    state.inFlight--;
    let out;
    if (name === "org_classification") out = ORG_OUT;
    else if (name === "kol_content") out = KOL_OUT;
    else if (name === "content_fit") {
      out = opts.fitBadFirst && state.fitCalls++ === 0 ? { ...FIT_OUT, topicalAdjacency: 9 } : FIT_OUT;
    } else if (name === "audience_batch") {
      const rows = (typeof body.input[1].content === "string" ? body.input[1].content : body.input[1].content[0].text)
        .split("\n").filter((l) => l.startsWith("- accountId=")).length;
      out = audienceOut(rows);
    } else out = {};
    return new Response(JSON.stringify({ output_text: JSON.stringify(out), usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
}
const newState = () => ({ requests: [], inFlight: 0, maxInFlight: 0, fitCalls: 0 });
const userText = (req) => (typeof req.input[1].content === "string" ? req.input[1].content : req.input[1].content.find((c) => c.type === "input_text").text);

(async () => {
  // --- 1. additive schemas -------------------------------------------------
  ck("old-shaped OrgClassification still validates",
    OrgClassificationSchema.safeParse({ keywords: [], confidence: "low" }).success);
  ck("old-shaped KolContentClassification still validates",
    KolContentClassificationSchema.safeParse({ themes: [], verticals: [], promoPatterns: [], repeatedTickers: [] }).success);
  ck("out-of-range rubric rejected by shared schema",
    !ContentFitAssessmentSchema.safeParse({ ...FIT_OUT, naturalMentionFit: 6 }).success);

  // --- 2. org targetBuckets ------------------------------------------------
  {
    const state = newState();
    const p = llm.createOpenAiLlmProvider({ apiKey: "k", model: "main-x", fetchImpl: makeFetch(state) });
    const org = await p.classifyOrgProfile({ handle: "uniswap", profile: null });
    ck("org targetBuckets round-trip", org.targetBuckets && org.targetBuckets.primary.includes("defi_users") && org.targetBuckets.secondary.includes("developers"));
    const schema = state.requests[0].text.format.schema;
    ck("org JSON schema requires targetBuckets", schema.required.includes("targetBuckets"));
    ck("org prompt asks for target buckets", userText(state.requests[0]).includes("targetBuckets"));
  }

  // --- 3. kol content: labels + flags + attached images --------------------
  {
    const state = newState();
    const p = llm.createOpenAiLlmProvider({ apiKey: "k", model: "main-x", fetchImpl: makeFetch(state), mediaImageLimit: 2 });
    const posts = [
      { id: "p1", text: "chart thread", media: [{ type: "photo", url: "https://pbs/chart.png" }] },
      { id: "p2", text: "promo post", media: [{ type: "video", previewUrl: "https://pbs/thumb.jpg" }] },
      { id: "p3", text: "third", media: [{ type: "photo", url: "https://pbs/extra.png" }] },
      { id: "p4", text: "plain post" },
    ];
    const out = await p.classifyKolContent({ handle: "kol", profile: null, posts });
    ck("postLabels round-trip (null coerced)", out.postLabels.length === 2 && out.postLabels[1].isPromo === true && out.postLabels[0].promoRelated === undefined);
    ck("brandSafetyFlags round-trip", out.brandSafetyFlags.length === 1 && out.brandSafetyFlags[0].flag === "excessive_drama");
    ck("mediaLabels round-trip", out.mediaLabels.length === 1 && out.mediaLabels[0].kind === "chart_or_data");
    const req = state.requests[0];
    const images = req.input[1].content.filter((c) => c.type === "input_image");
    ck("image parts attached + capped at limit", Array.isArray(req.input[1].content) && images.length === 2 && images[0].image_url === "https://pbs/chart.png" && images[1].image_url === "https://pbs/thumb.jpg");
    const text = userText(req);
    ck("prompt lists postIds + attached image ids", text.includes("[p1]") && text.includes("postIds: p1, p2"));
  }

  // --- 4+5. audience: enriched rows, concurrency, fast model, order --------
  {
    const state = newState();
    const p = llm.createOpenAiLlmProvider({ apiKey: "k", model: "main-x", fastModel: "fast-x", fetchImpl: makeFetch(state), audienceLimit: 300 });
    const accounts = Array.from({ length: 120 }, (_, i) => ({
      user: { id: `a${i}`, handle: `h${i}`, bio: i === 0 ? "solidity dev" : "bio", followersCount: 10 + i, followingCount: 5, tweetCount: 100, createdAt: "2019-05-01T00:00:00Z", verified: i === 0 },
      tweetId: "t1", source: "REPLY",
      text: i === 0 ? "wen airdrop ser" : undefined,
      appearances: 1,
    }));
    const res = await p.classifyAudienceAccounts({ accounts });
    ck("all sampled accounts classified", res.accounts.length === 120 && res.distribution.sampleSize === 120);
    // The sampler orders accounts deterministically (stable sort by user id);
    // concurrent batches must preserve that order when flattened.
    const expectedOrder = accounts.map((a) => a.user.id).sort();
    ck("output deterministically ordered across parallel batches", JSON.stringify(res.accounts.map((a) => a.accountId)) === JSON.stringify(expectedOrder));
    const audReqs = state.requests.filter((r) => r.text.format.name === "audience_batch");
    ck("batched at 40 → 3 requests", audReqs.length === 3);
    ck("audience batches use the fast model", audReqs.every((r) => r.model === "fast-x"));
    ck("audience batches ran concurrently", state.maxInFlight >= 2);
    const row0 = userText(audReqs[0]).split("\n").find((l) => l.includes("accountId=a0"));
    ck("audience row carries said= text + stats", row0.includes('said="wen airdrop ser"') && row0.includes("following=5") && row0.includes("since=2019") && row0.includes("verified"));
  }

  // --- 6. assessContentFit (incl. repair on out-of-range) ------------------
  {
    const state = newState();
    const p = llm.createOpenAiLlmProvider({ apiKey: "k", model: "main-x", fetchImpl: makeFetch(state, { fitBadFirst: true }) });
    const fit = await p.assessContentFit({
      org: { handle: "uniswap", classification: ORG_OUT },
      kol: { handle: "hayden", content: KOL_OUT },
    });
    ck("content-fit rubric validated after repair retry", fit.topicalAdjacency === 4 && state.requests.filter((r) => r.text.format.name === "content_fit").length === 2);
    ck("content-fit uses the MAIN model", state.requests.every((r) => r.model === "main-x"));
    ck("content-fit prompt forbids scores", userText(state.requests[0]).includes("no scores out of 100"));
  }

  // --- 7. mock determinism for the new fields ------------------------------
  {
    const mock = llm.createMockLlmProvider();
    const org = await mock.classifyOrgProfile({ handle: "acme", profile: { id: "u1", handle: "acme", bio: "Onchain perps for everyone. Trade with deep liquidity on L2." } });
    ck("mock org emits targetBuckets", org.targetBuckets && org.targetBuckets.primary.includes("traders"));
    const posts = [
      { id: "t1", text: "GIVEAWAY! dm me to claim 🎁" },
      { id: "t2", text: "real yield analysis", media: [{ type: "photo", url: "https://mock.local/media/yield-chart.png" }] },
    ];
    const content = await mock.classifyKolContent({ handle: "kol", profile: null, posts });
    ck("mock postLabels flag the promo post", content.postLabels.length === 2 && content.postLabels[0].isPromo === true && content.postLabels[1].isPromo === false);
    ck("mock mediaLabels label the chart", content.mediaLabels.length === 1 && content.mediaLabels[0].kind === "chart_or_data");
    ck("mock safety flags empty on clean content", content.brandSafetyFlags.length === 0);
    const fitA = await mock.assessContentFit({ org: { handle: "a", classification: org }, kol: { handle: "k", content } });
    const fitB = await mock.assessContentFit({ org: { handle: "a", classification: org }, kol: { handle: "k", content } });
    ck("mock content-fit deterministic + in range", JSON.stringify(fitA) === JSON.stringify(fitB) && [fitA.topicalAdjacency, fitA.audienceOverlapPotential, fitA.naturalMentionFit].every((v) => Number.isInteger(v) && v >= 0 && v <= 5));
  }

  // --- 8. cache: cls:v2, fit cached, audience key text-sensitive -----------
  {
    const calls = { fit: 0, audience: 0 };
    const inner = {
      model: "m",
      async classifyOrgProfile() { throw new Error("unused"); },
      async classifyKolContent() { throw new Error("unused"); },
      async classifyAudienceAccounts() { calls.audience++; return { accounts: [], distribution: { sampleSize: 0, buckets: {} } }; },
      async assessContentFit() { calls.fit++; return FIT_OUT; },
      async generateFitReport() { throw new Error("unused"); },
    };
    const store = new cache.InMemoryCacheStore();
    const keys = [];
    const spyStore = { get: (k) => store.get(k), set: (k, p, t) => { keys.push(k); return store.set(k, p, t); } };
    const config = { enabled: true, ttls: { orgSeconds: 60, contentSeconds: 60, audienceSeconds: 60 } };
    const p = cache.withLlmCache(inner, spyStore, config);
    const fitInput = { org: { handle: "a", classification: ORG_OUT }, kol: { handle: "k", content: KOL_OUT } };
    await p.assessContentFit(fitInput);
    await p.assessContentFit(fitInput);
    ck("assessContentFit cached (1 inner call, 1 hit)", calls.fit === 1 && p.cacheStats.fit.hits === 1 && p.cacheStats.fit.misses === 1);
    const acct = (text) => ({ user: { id: "a1", handle: "h1" }, tweetId: "t1", source: "REPLY", text });
    await p.classifyAudienceAccounts({ accounts: [acct("gm")] });
    await p.classifyAudienceAccounts({ accounts: [acct("gm")] });
    await p.classifyAudienceAccounts({ accounts: [acct("substantive reply")] });
    ck("audience cache text-sensitive (2 inner calls, 1 hit)", calls.audience === 2 && p.cacheStats.audience.hits === 1);
    ck("keys use the cls:v2 namespace", keys.length > 0 && keys.every((k) => k.startsWith("cls:v2:")));
  }

  console.log(`\nCLASSIFICATION V2 REGRESSION (29B): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
