// Regression check for Unit 19 (Caching and Cost Controls):
//   1. Twitter cache decorator: miss -> fetch+store, hit -> no fetch, TTL
//      expiry -> refetch, and miss-safe (store errors never fail a call).
//   2. resolveCaps: ANALYSIS_* env overrides on top of defaults, with invalid
//      values falling back.
//   3. sampleAudienceAccounts: deterministic, capped, proportional by source.
//
// Run after `pnpm build`:  node scripts/checks/cache-and-caps.regression.cjs
// (or `pnpm check:cache-and-caps`). No network, no DB, no keys — uses the
// in-memory cache store and injected clock.

const {
  InMemoryCacheStore,
  withTwitterCache,
} = require("../../packages/cache/dist/index.js");
const { resolveCaps } = require("../../packages/analysis/dist/index.js");
const {
  sampleAudienceAccounts,
} = require("../../packages/llm/dist/openai/sampling.js");

let pass = 0,
  fail = 0;
const ck = (n, c) => {
  console.log((c ? "OK   " : "FAIL ") + n);
  c ? pass++ : fail++;
};

const config = (enabled = true) => ({
  enabled,
  ttls: { profileSeconds: 100, tweetsSeconds: 100 },
});

// A minimal inner TwitterProvider that counts calls and returns canned data.
function fakeInner() {
  const calls = { profile: 0, tweets: 0 };
  return {
    calls,
    async getUserProfile(h) {
      calls.profile++;
      return { id: "u1", handle: h };
    },
    async getUserTweets(h, n) {
      calls.tweets++;
      return [{ id: "t1", text: `x${n}` }];
    },
    async getUserReplies() {
      return [];
    },
    async getTweetReplies() {
      return [];
    },
    async getTweetQuotes() {
      return [];
    },
    async getTweetRetweeters() {
      return [];
    },
    async getFollowers() {
      return [];
    },
    async searchTweets() {
      return [];
    },
  };
}

(async () => {
  // --- 1. Cache hit/miss ---
  {
    let t = 0;
    const store = new InMemoryCacheStore(() => new Date(t));
    const inner = fakeInner();
    const cached = withTwitterCache(inner, store, config());

    const a = await cached.getUserProfile("acme");
    const b = await cached.getUserProfile("acme");
    ck(
      `profile: miss then hit -> inner called once (got ${inner.calls.profile})`,
      inner.calls.profile === 1
    );
    ck("profile: hit returns same payload", JSON.stringify(a) === JSON.stringify(b));
    ck(
      `cacheStats hits=1 misses=1 (got ${cached.cacheStats.hits}/${cached.cacheStats.misses})`,
      cached.cacheStats.hits === 1 && cached.cacheStats.misses === 1
    );

    // Handle is normalized: different case = same key.
    await cached.getUserProfile("ACME");
    ck(
      `profile: case-insensitive key (still 1 inner call, got ${inner.calls.profile})`,
      inner.calls.profile === 1
    );

    // Different limit = different key.
    await cached.getUserTweets("acme", 10);
    await cached.getUserTweets("acme", 20);
    ck(
      `tweets: limit is part of key -> 2 inner calls (got ${inner.calls.tweets})`,
      inner.calls.tweets === 2
    );
  }

  // --- 2. TTL expiry ---
  {
    let t = 0;
    const store = new InMemoryCacheStore(() => new Date(t));
    const inner = fakeInner();
    const cached = withTwitterCache(inner, store, config());
    await cached.getUserProfile("acme"); // stored at t=0, expires t=100000ms
    t = 50_000;
    await cached.getUserProfile("acme"); // still fresh
    ck(
      `TTL: within window -> cached (1 call, got ${inner.calls.profile})`,
      inner.calls.profile === 1
    );
    t = 100_001;
    await cached.getUserProfile("acme"); // expired -> refetch
    ck(
      `TTL: after expiry -> refetch (2 calls, got ${inner.calls.profile})`,
      inner.calls.profile === 2
    );
  }

  // --- 3. Miss-safe: store throws -> call still succeeds, inner used ---
  {
    const brokenStore = {
      async get() {
        throw new Error("db down");
      },
      async set() {
        throw new Error("db down");
      },
    };
    const inner = fakeInner();
    const cached = withTwitterCache(inner, brokenStore, config());
    let ok = false;
    try {
      const r = await cached.getUserProfile("acme");
      ok = r && r.handle === "acme";
    } catch {
      ok = false;
    }
    ck("miss-safe: store errors do not fail the call", ok && inner.calls.profile === 1);
  }

  // --- 4. Disabled cache -> always passes through ---
  {
    const store = new InMemoryCacheStore();
    const inner = fakeInner();
    const cached = withTwitterCache(inner, store, config(false));
    await cached.getUserProfile("acme");
    await cached.getUserProfile("acme");
    ck(
      `disabled: pass-through every call (2 calls, got ${inner.calls.profile})`,
      inner.calls.profile === 2
    );
  }

  // --- 5. resolveCaps env overrides ---
  {
    const env = {
      ANALYSIS_KOL_POSTS_FETCHED: "42",
      ANALYSIS_MAX_UNIQUE_ENGAGED_ACCOUNTS: "-5", // invalid -> default
      ANALYSIS_REPLIES_PER_POST: "not-a-number", // invalid -> default
    };
    const caps = resolveCaps({}, env);
    ck(`caps: valid override applied (kolPostsFetched=${caps.kolPostsFetched})`, caps.kolPostsFetched === 42);
    ck(
      `caps: negative override ignored (maxUniqueEngagedAccounts=${caps.maxUniqueEngagedAccounts})`,
      caps.maxUniqueEngagedAccounts === 1500
    );
    ck(`caps: non-numeric override ignored (repliesPerPost=${caps.repliesPerPost})`, caps.repliesPerPost === 50);
    const overridden = resolveCaps({ kolPostsFetched: 7 }, env);
    ck(`caps: in-process override wins over env (${overridden.kolPostsFetched})`, overridden.kolPostsFetched === 7);
  }

  // --- 6. sampleAudienceAccounts ---
  {
    const mk = (id, source) => ({
      user: { id, handle: id },
      tweetId: "t",
      source,
    });
    // 80 REPLY, 20 QUOTE = 100 accounts; sample 10 -> proportional 8/2.
    const accounts = [];
    for (let i = 0; i < 80; i++) accounts.push(mk(`r${String(i).padStart(3, "0")}`, "REPLY"));
    for (let i = 0; i < 20; i++) accounts.push(mk(`q${String(i).padStart(3, "0")}`, "QUOTE"));

    const s1 = sampleAudienceAccounts(accounts, 10);
    const s2 = sampleAudienceAccounts([...accounts].reverse(), 10);
    ck(`sample: capped at limit (got ${s1.length})`, s1.length === 10);
    const replies = s1.filter((a) => a.source === "REPLY").length;
    const quotes = s1.filter((a) => a.source === "QUOTE").length;
    ck(`sample: proportional by source (REPLY=${replies}, QUOTE=${quotes})`, replies === 8 && quotes === 2);
    ck(
      "sample: deterministic regardless of input order",
      JSON.stringify(s1.map((a) => a.user.id)) === JSON.stringify(s2.map((a) => a.user.id))
    );
    // Representative spread: not just the first 8 replies (r000..r007).
    const first8 = ["r000", "r001", "r002", "r003", "r004", "r005", "r006", "r007"];
    const sampledReplyIds = s1.filter((a) => a.source === "REPLY").map((a) => a.user.id);
    ck(
      "sample: spreads across the group (not first-N)",
      JSON.stringify(sampledReplyIds) !== JSON.stringify(first8)
    );
    // Below limit -> return all (stably sorted).
    const small = sampleAudienceAccounts(accounts.slice(0, 5), 10);
    ck(`sample: fewer than limit -> all returned (got ${small.length})`, small.length === 5);
  }

  console.log(`\nCACHE + CAPS REGRESSION: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
