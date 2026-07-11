// Regression check for Unit 23 (cross-analysis classification cache):
// content-addressed reuse of the expensive LLM classifications.
//   - identical inputs -> served from cache (inner not called again)
//   - changed inputs (post id / account id / brief / order) -> correct miss/hit
//   - generateFitReport is NEVER cached (pair-specific)
//   - miss-safe (throwing store) + re-validate bad cached payloads
//   - CLASSIFICATION_CACHE_ENABLED=false -> pass-through
//
// Run after `pnpm build`:  node scripts/checks/llm-cache.regression.cjs
// (or `pnpm check:llm-cache`). No network, no DB, no keys.

const {
  InMemoryCacheStore,
  withLlmCache,
} = require("../../packages/cache/dist/index.js");

let pass = 0,
  fail = 0;
const ck = (n, c) => {
  console.log((c ? "OK   " : "FAIL ") + n);
  c ? pass++ : fail++;
};

const cfg = (enabled = true) => ({
  enabled,
  ttls: { orgSeconds: 100, contentSeconds: 100, audienceSeconds: 100 },
});

// Spy provider returning schema-valid classifications; counts calls per method.
function spy() {
  const calls = { org: 0, content: 0, audience: 0, report: 0 };
  return {
    calls,
    model: "test-model",
    async classifyOrgProfile() {
      calls.org++;
      return { keywords: [], confidence: "high" };
    },
    async classifyKolContent() {
      calls.content++;
      return { themes: [], verticals: [], promoPatterns: [], repeatedTickers: [] };
    },
    async classifyAudienceAccounts() {
      calls.audience++;
      return { accounts: [], distribution: { sampleSize: 0, buckets: {} } };
    },
    async generateFitReport() {
      calls.report++;
      return { placeholder: true };
    },
  };
}

const acct = (id, source = "REPLY") => ({
  user: { id, handle: id },
  tweetId: "t",
  source,
});
const post = (id) => ({ id, text: "x" });

(async () => {
  // --- content: identical -> hit; different post -> miss ---
  {
    const inner = spy();
    const c = withLlmCache(inner, new InMemoryCacheStore(), cfg());
    const input = { handle: "@KOL", profile: { id: "u1" }, posts: [post("p1"), post("p2")] };
    await c.classifyKolContent(input);
    await c.classifyKolContent({ ...input, posts: [post("p2"), post("p1")] }); // reordered = same
    ck(`content: identical (reordered) inputs -> 1 inner call (got ${inner.calls.content})`, inner.calls.content === 1);
    await c.classifyKolContent({ ...input, posts: [post("p1"), post("p3")] }); // changed
    ck(`content: changed posts -> recompute (got ${inner.calls.content})`, inner.calls.content === 2);
    ck(`content cacheStats hits=1 misses=2 (${c.cacheStats.content.hits}/${c.cacheStats.content.misses})`, c.cacheStats.content.hits === 1 && c.cacheStats.content.misses === 2);
  }

  // --- audience: order-independent hit; changed account -> miss ---
  {
    const inner = spy();
    const c = withLlmCache(inner, new InMemoryCacheStore(), cfg());
    await c.classifyAudienceAccounts({ accounts: [acct("a"), acct("b"), acct("c")] });
    await c.classifyAudienceAccounts({ accounts: [acct("c"), acct("a"), acct("b")] }); // reordered
    ck(`audience: order-independent hit -> 1 inner call (got ${inner.calls.audience})`, inner.calls.audience === 1);
    await c.classifyAudienceAccounts({ accounts: [acct("a"), acct("b"), acct("d")] }); // changed set
    ck(`audience: changed accounts -> recompute (got ${inner.calls.audience})`, inner.calls.audience === 2);
    // different source on same id -> different key
    await c.classifyAudienceAccounts({ accounts: [acct("a", "QUOTE"), acct("b"), acct("c")] });
    ck(`audience: changed source -> recompute (got ${inner.calls.audience})`, inner.calls.audience === 3);
  }

  // --- org: identical -> hit; different brief -> miss ---
  {
    const inner = spy();
    const c = withLlmCache(inner, new InMemoryCacheStore(), cfg());
    const base = { handle: "@ORG", profile: { id: "o1" }, manualBrief: { productCategory: "DeFi" } };
    await c.classifyOrgProfile(base);
    await c.classifyOrgProfile({ ...base });
    ck(`org: identical -> 1 inner call (got ${inner.calls.org})`, inner.calls.org === 1);
    await c.classifyOrgProfile({ ...base, manualBrief: { productCategory: "NFT" } });
    ck(`org: different brief -> recompute (got ${inner.calls.org})`, inner.calls.org === 2);
  }

  // --- generateFitReport is NEVER cached ---
  {
    const inner = spy();
    const c = withLlmCache(inner, new InMemoryCacheStore(), cfg());
    const rin = { org: { handle: "@O", classification: {} }, kol: { handle: "@K", content: {} }, audience: {} };
    await c.generateFitReport(rin);
    await c.generateFitReport(rin);
    ck(`report: never cached -> 2 inner calls (got ${inner.calls.report})`, inner.calls.report === 2);
  }

  // --- miss-safe: throwing store -> still returns live value ---
  {
    const inner = spy();
    const broken = { async get() { throw new Error("db down"); }, async set() { throw new Error("db down"); } };
    const c = withLlmCache(inner, broken, cfg());
    let ok = false;
    try {
      const r = await c.classifyKolContent({ handle: "@K", profile: null, posts: [post("p1")] });
      ok = Array.isArray(r.themes);
    } catch { ok = false; }
    ck("miss-safe: throwing store still returns live value", ok && inner.calls.content === 1);
  }

  // --- re-validate: bad cached payload -> treated as miss ---
  {
    const inner = spy();
    const badStore = {
      async get() { return { payload: { not: "valid" }, fetchedAt: new Date() }; },
      async set() {},
    };
    const c = withLlmCache(inner, badStore, cfg());
    const r = await c.classifyAudienceAccounts({ accounts: [acct("a")] });
    ck("re-validate: invalid cached payload -> recompute", inner.calls.audience === 1 && r.distribution.sampleSize === 0);
  }

  // --- disabled -> pass-through ---
  {
    const inner = spy();
    const c = withLlmCache(inner, new InMemoryCacheStore(), cfg(false));
    const input = { handle: "@K", profile: null, posts: [post("p1")] };
    await c.classifyKolContent(input);
    await c.classifyKolContent(input);
    ck(`disabled: pass-through -> 2 inner calls (got ${inner.calls.content})`, inner.calls.content === 2);
  }

  console.log(`\nLLM CLASSIFICATION CACHE REGRESSION: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
