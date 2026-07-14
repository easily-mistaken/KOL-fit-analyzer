// Unit 29D regression: pipeline parallelism. Verifies (1) per-post engagement
// fetches run with bounded concurrency (and honor engagementConcurrency: 1),
// (2) the parallel output is byte-identical to a sequential run (determinism),
// (3) org + KOL-content LLM calls overlap, (4) website/docs ingestion overlaps
// the Twitter fetch, and (5) the retweeter cap rebalance (100 -> 50) with env
// override intact.
//
// Run after `pnpm build`:  node scripts/checks/pipeline-latency.regression.cjs
// (or `pnpm check:pipeline-latency`). Injected delayed providers — no network.

const tw = require("../../packages/twitter/dist/index.js");
const llmPkg = require("../../packages/llm/dist/index.js");
const { runAnalysis, resolveCaps } = require("../../packages/analysis/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const REQ = { orgHandle: "acmeprotocol", kolHandle: "cryptowhale", websiteUrl: "https://example.com", docsUrl: null, productCategory: null, targetUser: null, campaignGoal: null, stage: null, region: null };
const FIXED_NOW = () => new Date("2026-01-01T00:00:00.000Z");

/** Mock Twitter wrapped with per-call delay + engagement in-flight tracking. */
function trackedTwitter(delayMs, state) {
  const inner = tw.createMockTwitterProvider();
  const eng = (name) => async (...args) => {
    state.engCalls++;
    state.engInFlight++;
    state.engMaxInFlight = Math.max(state.engMaxInFlight, state.engInFlight);
    await sleep(delayMs);
    const r = await inner[name](...args);
    state.engInFlight--;
    return r;
  };
  const plain = (name) => async (...args) => {
    state.twitterStarted = true;
    await sleep(delayMs);
    return inner[name](...args);
  };
  return {
    getUserProfile: plain("getUserProfile"),
    getUserTweets: plain("getUserTweets"),
    getUserReplies: plain("getUserReplies"),
    getTweetReplies: eng("getTweetReplies"),
    getTweetQuotes: eng("getTweetQuotes"),
    getTweetRetweeters: eng("getTweetRetweeters"),
    getFollowers: (...a) => inner.getFollowers(...a),
    searchTweets: (...a) => inner.searchTweets(...a),
  };
}

/** Mock LLM wrapped with delay + org/content overlap tracking. */
function trackedLlm(delayMs, state) {
  const inner = llmPkg.createMockLlmProvider();
  const classify = (name) => async (input) => {
    state.clsInFlight++;
    state.clsMaxInFlight = Math.max(state.clsMaxInFlight, state.clsInFlight);
    await sleep(delayMs);
    const r = await inner[name](input);
    state.clsInFlight--;
    return r;
  };
  return {
    model: inner.model,
    classifyOrgProfile: classify("classifyOrgProfile"),
    classifyKolContent: classify("classifyKolContent"),
    classifyAudienceAccounts: (i) => inner.classifyAudienceAccounts(i),
    assessContentFit: (i) => inner.assessContentFit(i),
    generateFitReport: (i) => inner.generateFitReport(i),
  };
}

const newState = () => ({ engCalls: 0, engInFlight: 0, engMaxInFlight: 0, clsInFlight: 0, clsMaxInFlight: 0, twitterStarted: false, ingestSawTwitterStarted: null });

function trackedIngest(state) {
  return async () => {
    await sleep(40);
    state.ingestSawTwitterStarted = state.twitterStarted;
    return {
      website: { url: undefined, kind: "website", status: "skipped", extractedText: "", charCount: 0 },
      docs: { url: undefined, kind: "docs", status: "skipped", extractedText: "", charCount: 0 },
      combinedText: "",
    };
  };
}

(async () => {
  // --- 1+2+3+4. parallel run --------------------------------------------------
  const parState = newState();
  const parallel = await runAnalysis(REQ, {
    twitter: trackedTwitter(15, parState),
    llm: trackedLlm(20, parState),
    performWebIngestion: true,
    ingest: trackedIngest(parState),
    now: FIXED_NOW,
  });
  // Mock KOL has 12 posts -> 12 top posts x 3 engagement calls.
  ck(`engagement calls issued (${parState.engCalls} = 36)`, parState.engCalls === 36);
  ck(`engagement fetches overlap across posts (max in-flight ${parState.engMaxInFlight} > 3)`, parState.engMaxInFlight > 3);
  ck(`org + kol-content LLM calls overlap (max in-flight ${parState.clsMaxInFlight} >= 2)`, parState.clsMaxInFlight >= 2);
  ck("ingestion overlapped the Twitter fetch", parState.ingestSawTwitterStarted === true);

  // Sequential-equivalent run (concurrency 1) must be byte-identical.
  const seqState = newState();
  const sequential = await runAnalysis(REQ, {
    twitter: trackedTwitter(5, seqState),
    llm: trackedLlm(5, seqState),
    performWebIngestion: true,
    ingest: trackedIngest(seqState),
    engagementConcurrency: 1,
    now: FIXED_NOW,
  });
  ck(`engagementConcurrency: 1 honored (max in-flight ${seqState.engMaxInFlight} <= 3)`, seqState.engMaxInFlight <= 3);
  ck("parallel output byte-identical to sequential (report)", JSON.stringify(parallel.report) === JSON.stringify(sequential.report));
  ck("parallel output byte-identical to sequential (scores)", JSON.stringify(parallel.scores) === JSON.stringify(sequential.scores));

  // --- 5. caps rebalance -------------------------------------------------------
  ck("resolveCaps default retweetersPerPost = 50", resolveCaps({}, {}).retweetersPerPost === 50);
  ck("env override still works (120)", resolveCaps({}, { ANALYSIS_RETWEETERS_PER_POST: "120" }).retweetersPerPost === 120);

  console.log(`\nPIPELINE LATENCY REGRESSION (29D): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
