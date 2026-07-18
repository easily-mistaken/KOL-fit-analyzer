// Regression for the 2026-07-14 live-calibration incident: cache keys carried
// no provider KIND, so a mock-provider run wrote mock fixtures into the shared
// DB cache under the exact keys a live run reads (the mock also echoes
// LLM_MODEL, defeating the model component of LLM keys). The first live
// calibration run was served 100% mock data. Keys are now namespaced by
// provider kind (tw:v2:<kind>:…, cls:v2:<kind>:…), defaulting to the same env
// the provider factories resolve.
//
// Run after `pnpm build`:  node scripts/checks/cache-poisoning.regression.cjs
// (or `pnpm check:cache-poisoning`). Offline — no network, no keys, no DB.

const cache = require("../../packages/cache/dist/index.js");
const tw = require("../../packages/twitter/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

const spyStore = () => {
  const inner = new cache.InMemoryCacheStore();
  const keys = [];
  return { keys, get: (k) => inner.get(k), set: (k, p, t) => { keys.push(k); return inner.set(k, p, t); } };
};
const twConfig = { enabled: true, ttls: { profileSeconds: 60, tweetsSeconds: 60 } };
const llmConfig = { enabled: true, ttls: { orgSeconds: 60, contentSeconds: 60, audienceSeconds: 60 } };

(async () => {
  // --- Twitter cache: kind in every key -------------------------------------
  {
    const mockStore = spyStore();
    const liveStore = spyStore();
    const mocked = cache.withTwitterCache(tw.createMockTwitterProvider(), mockStore, twConfig, "mock");
    const live = cache.withTwitterCache(tw.createMockTwitterProvider(), liveStore, twConfig, "twitterapi");
    await mocked.getUserTweets("uniswap", 10);
    await live.getUserTweets("uniswap", 10);
    ck("mock twitter keys carry the kind", mockStore.keys.every((k) => k.startsWith("tw:v2:mock:")));
    ck("live twitter keys carry the kind", liveStore.keys.every((k) => k.startsWith("tw:v2:twitterapi:")));
    ck("same handle, different kind -> disjoint keys", mockStore.keys[0] !== liveStore.keys[0]);

    // THE incident scenario: a mock run pre-populates a SHARED store; a live
    // provider behind the cache must NOT be served the mock payload.
    const shared = spyStore();
    const mockShared = cache.withTwitterCache(tw.createMockTwitterProvider(), shared, twConfig, "mock");
    await mockShared.getUserTweets("uniswap", 10); // poison attempt
    let innerCalls = 0;
    const fakeLive = {
      async getUserTweets() { innerCalls++; return [{ id: "real1", text: "real tweet" }]; },
    };
    const liveShared = cache.withTwitterCache(fakeLive, shared, twConfig, "twitterapi");
    const got = await liveShared.getUserTweets("uniswap", 10);
    ck("live run bypasses mock-written entries (inner called)", innerCalls === 1 && got[0].id === "real1");
  }

  // --- Twitter cache: kind defaults from TWITTER_PROVIDER env ----------------
  {
    const prev = process.env.TWITTER_PROVIDER;
    process.env.TWITTER_PROVIDER = "twitterapi";
    const store = spyStore();
    const p = cache.withTwitterCache(tw.createMockTwitterProvider(), store, twConfig);
    await p.getUserProfile("acme");
    ck("twitter kind defaults from env", store.keys[0].startsWith("tw:v2:twitterapi:"));
    if (prev === undefined) delete process.env.TWITTER_PROVIDER; else process.env.TWITTER_PROVIDER = prev;
  }

  // --- LLM cache: kind in every key (mock echoes the model — kind saves us) --
  {
    const FIT = { topicalAdjacency: 3, audienceOverlapPotential: 3, naturalMentionFit: 3, sharedTopics: [], rationale: "x" };
    const innerOf = (tag, calls) => ({
      model: "gpt-5-mini", // both providers report the SAME model (the trap)
      async classifyOrgProfile() { calls.n++; return { keywords: [tag], confidence: "low" }; },
      async classifyKolContent() { return { themes: [], verticals: [], promoPatterns: [], repeatedTickers: [] }; },
      async classifyAudienceAccounts() { return { accounts: [], distribution: { sampleSize: 0, buckets: {} } }; },
      async assessContentFit() { return FIT; },
      async generateFitReport() { throw new Error("unused"); },
    });
    const shared = spyStore();
    const mockCalls = { n: 0 };
    const liveCalls = { n: 0 };
    const mocked = cache.withLlmCache(innerOf("mock", mockCalls), shared, llmConfig, "mock");
    const live = cache.withLlmCache(innerOf("live", liveCalls), shared, llmConfig, "openai");
    const input = { handle: "uniswap", profile: null };
    const a = await mocked.classifyOrgProfile(input); // poison attempt
    const b = await live.classifyOrgProfile(input);
    ck("llm keys carry the kind", shared.keys.some((k) => k.startsWith("cls:v3:mock:")) && shared.keys.some((k) => k.startsWith("cls:v3:openai:")));
    ck("same model+input, different kind -> live NOT served mock payload", liveCalls.n === 1 && a.keywords[0] === "mock" && b.keywords[0] === "live");
  }

  console.log(`\nCACHE POISONING REGRESSION: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
