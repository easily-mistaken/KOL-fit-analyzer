// Unit 48 regression: activity + originality. Three claims under test:
//
//   1. SCORING — overall fit = EAM x activity(days since last original post)
//      x originality(repost share), both down-only, both skipped (factor 1)
//      when their input is missing. Verdict follows the discounted score.
//   2. REPOST DETECTION — Tweet.isRetweet from the API's retweeted_tweet field,
//      with the "RT @" text prefix as the fallback that also covers payloads
//      cached before the flag existed (tw:v2).
//   3. PIPELINE — reposts are excluded from top-post selection (their
//      engagement belongs to the ORIGINAL author), content classification,
//      post languages, and expected-reach volume; the freshness probe rides
//      the SHORT probe TTL while the bulk timeline rides the long one.
//
// Run after `pnpm build`:  node scripts/checks/activity-originality.regression.cjs
// (or `pnpm check:activity-originality`). No network, no keys, no DB.

const s = require("../../packages/scoring/dist/index.js");
const shared = require("../../packages/shared/dist/index.js");
const tw = require("../../packages/twitter/dist/index.js");
const { normalizeTweet } = require("../../packages/twitter/dist/twitterapi/normalize.js");
const { runAnalysis } = require("../../packages/analysis/dist/index.js");
const llmPkg = require("../../packages/llm/dist/index.js");
const cache = require("../../packages/cache/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

// --- scoring fixture (mirrors scoring-v3's idiom, defi-enthusiast audience) --

function audienceOf(spec) {
  const accounts = [];
  let i = 0;
  for (const [key, count] of Object.entries(spec)) {
    const [role, domain, quality = "real"] = key.split("/");
    for (let k = 0; k < count; k++) {
      accounts.push({
        accountId: `a${i}`, handle: `h${i++}`, source: "REPLY", role, domain, quality,
        signals: { botScore: 0.1, emptyBio: false, farmingSignals: [] },
      });
    }
  }
  const tally = (pick) => {
    const counts = {};
    for (const a of accounts) counts[pick(a)] = (counts[pick(a)] ?? 0) + 1;
    const out = {};
    for (const [k, c] of Object.entries(counts)) out[k] = { count: c, share: c / accounts.length };
    return out;
  };
  return {
    accounts,
    distribution: { sampleSize: accounts.length, roles: tally((a) => a.role), domains: tally((a) => a.domain), quality: tally((a) => a.quality) },
  };
}

const AUDIENCE = audienceOf({ "enthusiast/crypto_defi": 60, "trader/crypto_defi": 40 });

const input = (sampleOverrides = {}) => ({
  org: {
    productCategory: "DeFi / AMM", targetUser: "traders", keywords: ["defi"], confidence: "high",
    targetRoles: { primary: ["enthusiast", "trader"], secondary: [] },
    targetDomains: { primary: ["crypto_defi"], secondary: [] },
  },
  content: { themes: ["defi"], verticals: ["defi"], style: "analytical", depth: "high", promoPatterns: [], repeatedTickers: [], postLabels: [{ postId: "p0", isPromo: false }], brandSafetyFlags: [], mediaLabels: [] },
  audience: AUDIENCE,
  sample: { kolPostsSampled: 100, kolRepliesSampled: 50, topPostsAnalyzed: 20, engagedAccountsSampled: 1500, engagedAccountsClassified: 100, repeatEngagerShare: 0.1, ...sampleOverrides },
  evidence: { websiteFetched: false, docsFetched: false, hasEngagementText: true },
  brief: { campaignGoal: null, region: null, productCategory: null, targetUser: null, stage: null },
});

// --- 1. scoring: activity multiplier -----------------------------------------
{
  const base = s.scoreAnalysis(input()).scores.overall.value;
  ck(`no activity data -> no penalty (overall ${base})`, base === s.scoreAnalysis(input({ daysSinceLastOriginalPost: undefined })).scores.overall.value);
  const active = s.scoreAnalysis(input({ daysSinceLastOriginalPost: 3, originalPostsPerWeek: 12 }));
  ck("active (3 days) -> factor 1, overall unchanged", active.scores.overall.value === base);
  ck("active run still SAYS it is active (reason present)", active.scores.overall.reasons.some((r) => r.startsWith("Active:")));
  const month = s.scoreAnalysis(input({ daysSinceLastOriginalPost: 30 })).scores.overall.value;
  ck(`30 days silent -> x0.75 (${month} == ${Math.round(base * 0.75)})`, month === Math.max(0, Math.min(100, Math.round(base * 0.75))));
  const dormant = s.scoreAnalysis(input({ daysSinceLastOriginalPost: 180 }));
  ck(`180 days dormant -> floors at x0.35 (${dormant.scores.overall.value})`, dormant.scores.overall.value === Math.round(base * 0.35));
  ck("dormant reason names low activity", dormant.scores.overall.reasons.some((r) => r.startsWith("Low activity:")));
  ck("negative/NaN days -> no penalty", s.scoreAnalysis(input({ daysSinceLastOriginalPost: -5 })).scores.overall.value === base && s.scoreAnalysis(input({ daysSinceLastOriginalPost: NaN })).scores.overall.value === base);
}

// --- 2. scoring: originality multiplier --------------------------------------
{
  const base = s.scoreAnalysis(input()).scores.overall.value;
  ck("10% reposts -> free (normal curation)", s.scoreAnalysis(input({ repostShare: 0.1 })).scores.overall.value === base);
  const heavy = s.scoreAnalysis(input({ repostShare: 0.6 }));
  ck(`60% reposts -> x0.75 (${heavy.scores.overall.value})`, heavy.scores.overall.value === Math.round(base * 0.75));
  ck("heavy-repost reason present", heavy.scores.overall.reasons.some((r) => r.startsWith("Heavy reposting:")));
  ck("100% reposts -> floors at x0.35", s.scoreAnalysis(input({ repostShare: 1 })).scores.overall.value === Math.round(base * 0.35));
  // Cadence relief (user decision 2026-07-23): reposting freely is fine while
  // original output stays healthy — the penalty targets a thinned own voice.
  const relieved = s.scoreAnalysis(input({ repostShare: 0.6, originalPostsPerWeek: 5 }));
  ck("60% reposts + 5 originals/week -> NO penalty (cadence relief)", relieved.scores.overall.value === base);
  ck("relief reason says original output is healthy", relieved.scores.overall.reasons.some((r) => r.includes("original output is healthy")));
  const halfRelief = s.scoreAnalysis(input({ repostShare: 0.6, originalPostsPerWeek: 1.5 }));
  ck(`60% reposts + 1.5/week -> half severity (${halfRelief.scores.overall.value} == ${Math.round(base * 0.875)})`, halfRelief.scores.overall.value === Math.round(base * 0.875));
  ck("thin-output reason names both signals", halfRelief.scores.overall.reasons.some((r) => r.startsWith("Heavy reposting with thin original output:")));
  const both = s.scoreAnalysis(input({ daysSinceLastOriginalPost: 30, repostShare: 0.6 }));
  ck("factors MULTIPLY (30d x 60% reposts -> x0.5625)", both.scores.overall.value === Math.round(base * 0.75 * 0.75));
  ck("EAM component stays PURE (audience unchanged by factors)", both.scores.components.engaged_audience_match.value === s.scoreAnalysis(input()).scores.components.engaged_audience_match.value);
  ck("verdict follows the discounted overall", both.verdict === s.verdictFromScore(both.scores.overall.value, { paidPromoRisk: 0, botFarmRisk: 0, promoUnrelatedShare: 0, brandSafety: 100 }));
  ck("deterministic", JSON.stringify(s.scoreAnalysis(input({ daysSinceLastOriginalPost: 30, repostShare: 0.6 }))) === JSON.stringify(both));
}

// --- 3. repost detection ------------------------------------------------------
{
  const post = (over) => ({ id: "1", text: "gm, shipped a thing", ...over });
  ck("isRepost: plain post false", shared.isRepost(post({})) === false);
  ck("isRepost: isRetweet flag true", shared.isRepost(post({ isRetweet: true })) === true);
  ck("isRepost: legacy 'RT @' text true (pre-flag cached payloads)", shared.isRepost(post({ text: "RT @alice: alpha" })) === true);
  ck("isRepost: quote is NOT a repost", shared.isRepost(post({ isQuote: true })) === false);

  const raw = (over) => ({ id: "9", author: { id: "u1", userName: "kol" }, text: "hello world", createdAt: "Tue Jul 21 07:00:00 +0000 2026", likeCount: 5, retweetCount: 1, replyCount: 0, quoteCount: 0, ...over });
  ck("normalizeTweet: plain -> isRetweet false", normalizeTweet(raw({})).isRetweet === false);
  ck("normalizeTweet: retweeted_tweet field -> isRetweet true", normalizeTweet(raw({ retweeted_tweet: { id: "8" } })).isRetweet === true);
  ck("normalizeTweet: 'RT @' text -> isRetweet true (field missing)", normalizeTweet(raw({ text: "RT @bob: big news" })).isRetweet === true);
}

// --- 4. pipeline: reposts excluded, activity fed from the probe ---------------
(async () => {
  const NOW = () => new Date("2026-07-23T00:00:00.000Z");
  const day = (n) => new Date(NOW().getTime() - n * 86400000).toUTCString();
  // 10 originals (modest engagement, recent) + 1 VIRAL repost that would win
  // top-post selection if it were ever eligible.
  const originals = Array.from({ length: 10 }, (_, i) => ({
    id: `o${i}`, text: `original post ${i} about defi`, createdAt: day(i + 2),
    likeCount: 10, retweetCount: 2, replyCount: 3, quoteCount: 1, lang: "en",
  }));
  const viralRepost = { id: "rt1", text: "RT @whale: moon soon", isRetweet: true, createdAt: day(1), likeCount: 90000, retweetCount: 40000, replyCount: 8000, quoteCount: 2000, lang: "es" };
  const mock = tw.createMockTwitterProvider();
  const engagementIds = new Set();
  const twitter = {
    getUserProfile: (h) => mock.getUserProfile(h),
    getUserTweets: async () => [viralRepost, ...originals],
    getLatestTweets: async () => [viralRepost, ...originals.slice(0, 3)],
    getUserReplies: async () => [],
    getTweetReplies: (id, n) => { engagementIds.add(id); return mock.getTweetReplies(id, n); },
    getTweetQuotes: (id, n) => { engagementIds.add(id); return mock.getTweetQuotes(id, n); },
    getTweetRetweeters: (id, n) => { engagementIds.add(id); return mock.getTweetRetweeters(id, n); },
    getFollowers: (h, n) => mock.getFollowers(h, n),
    searchTweets: (q, n) => mock.searchTweets(q, n),
  };
  const inner = llmPkg.createMockLlmProvider();
  let contentPosts = null;
  const llm = {
    model: inner.model,
    classifyOrgProfile: (i) => inner.classifyOrgProfile(i),
    classifyKolContent: (i) => { contentPosts = i.posts; return inner.classifyKolContent(i); },
    classifyAudienceAccounts: (i) => inner.classifyAudienceAccounts(i),
    assessContentFit: (i) => inner.assessContentFit(i),
    generateFitReport: (i) => inner.generateFitReport(i),
  };
  const req = { orgHandle: "acmeprotocol", kolHandle: "cryptowhale", websiteUrl: null, docsUrl: null, productCategory: null, targetUser: null, campaignGoal: null, stage: null, region: null };
  const result = await runAnalysis(req, { twitter, llm, now: NOW });

  ck("viral repost NEVER reaches engagement fetch", !engagementIds.has("rt1"));
  ck(`all 10 originals deep-analyzed (${engagementIds.size})`, engagementIds.size === 10);
  ck("repost text kept OUT of content classification", Array.isArray(contentPosts) && contentPosts.every((p) => p.id !== "rt1"));
  ck("report sample counts ORIGINAL posts (10, not 11)", result.report.evidence.sampleSizes.kolPosts === 10);
  const note = result.report.evidence.notes.find((n) => n.startsWith("Timeline:"));
  ck("evidence note records fetch + repost exclusion", Boolean(note) && note.includes("11 recent posts fetched") && note.includes("1 reposts"));
  ck("repost share (1/11 = 9%) is under the free allowance -> no discount", !result.scores.overall.reasons.some((r) => r.startsWith("Heavy reposting:")));
  ck("activity read from the probe (newest original 2 days old -> Active)", result.scores.overall.reasons.some((r) => r.startsWith("Active: last original post 2 days ago")));

  // All-repost timeline fails LOUDLY (no garbage report).
  let threw = null;
  try {
    await runAnalysis(req, { twitter: { ...twitter, getUserTweets: async () => [viralRepost], getLatestTweets: async () => [viralRepost] }, llm, now: NOW });
  } catch (e) { threw = e; }
  ck("all-repost timeline throws with an explanatory message", Boolean(threw) && /reposts of other accounts/.test(threw.message));

  // A provider WITHOUT the optional probe still works (falls back to timeline).
  const { getLatestTweets, ...bare } = twitter;
  const noProbe = await runAnalysis(req, { twitter: bare, llm, now: NOW });
  ck("probe-less provider degrades to timeline-based activity", noProbe.scores.overall.reasons.some((r) => r.startsWith("Active: last original post 2 days ago")));

  // --- 5. cache: probe TTL is short + independent of the bulk TTL -------------
  let t = new Date("2026-07-23T00:00:00.000Z");
  const store = new cache.InMemoryCacheStore(() => t);
  const calls = { tweets: 0, probe: 0 };
  const counted = {
    ...twitter,
    getUserTweets: async () => { calls.tweets++; return originals; },
    getLatestTweets: async () => { calls.probe++; return originals.slice(0, 3); },
  };
  const cfg = { enabled: true, ttls: { profileSeconds: 3600, tweetsSeconds: 2592000, probeSeconds: 21600 } };
  const cached = cache.withTwitterCache(counted, store, cfg, "mock");
  await cached.getUserTweets("cryptowhale", 100);
  await cached.getLatestTweets("cryptowhale", 20);
  await cached.getUserTweets("cryptowhale", 100);
  await cached.getLatestTweets("cryptowhale", 20);
  ck("both cached on repeat within TTL", calls.tweets === 1 && calls.probe === 1);
  t = new Date(t.getTime() + 7 * 3600 * 1000); // +7h: probe expired, bulk not
  await cached.getUserTweets("cryptowhale", 100);
  await cached.getLatestTweets("cryptowhale", 20);
  ck("7h later: probe REFETCHES while bulk timeline stays cached", calls.tweets === 1 && calls.probe === 2);
  const probeCfg = cache.resolveCacheConfig();
  ck("probe TTL defaults to 6h and ignores CACHE_TTL_SECONDS", probeCfg.ttls.probeSeconds === 21600);

  console.log(`\nACTIVITY + ORIGINALITY REGRESSION (48): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
