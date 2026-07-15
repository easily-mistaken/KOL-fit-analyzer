// Unit 31 regression: media scoring. Verifies (1) visual-only promos (image
// labeled promo_graphic under non-promo text) join the promo saturation,
// (2) posts already labeled promo are not double-counted, (3) the deterministic
// media-profile reason on content_fit, (4) scores are byte-identical when no
// media labels exist, and (5) the raised default image limit.
//
// Run after `pnpm build`:  node scripts/checks/media-scoring.regression.cjs
// (or `pnpm check:media-scoring`). Offline — no network, no keys, no DB.

const s = require("../../packages/scoring/dist/index.js");
const llm = require("../../packages/llm/dist/index.js");

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

const AUD = audienceOf({ defi_users: 50, non_crypto: 50 });
const postLabels = (n, promo) => Array.from({ length: n }, (_, i) => (i < promo ? { postId: `p${i}`, isPromo: true, promoRelated: true, promoQuality: "ok" } : { postId: `p${i}`, isPromo: false }));

const input = (content = {}) => ({
  org: { productCategory: "DeFi", targetUser: "traders", keywords: [], confidence: "high", targetBuckets: { primary: ["defi_users"], secondary: [] } },
  content: {
    themes: ["defi"], verticals: ["defi"], promoPatterns: [], repeatedTickers: [],
    postLabels: postLabels(20, 2), brandSafetyFlags: [], mediaLabels: [],
    ...content,
  },
  audience: AUD,
  sample: { kolPostsSampled: 100, kolRepliesSampled: 50, topPostsAnalyzed: 20, engagedAccountsSampled: 500, engagedAccountsClassified: 100, repeatEngagerShare: 0 },
  evidence: { websiteFetched: false, docsFetched: false, hasEngagementText: true },
  brief: { campaignGoal: null, region: null, productCategory: null, targetUser: null, stage: null },
  contentFitAssessment: { topicalAdjacency: 4, audienceOverlapPotential: 4, naturalMentionFit: 4, audienceIntentOverlap: 4, sharedTopics: [], rationale: "x" },
  kolPostLangs: ["en"],
});

(async () => {
  // --- 1. visual-only promos raise saturation ---------------------------------
  {
    const textOnly = s.scoreAnalysis(input()).scores.components.paid_promo_risk;
    // 4 innocent-text posts carry promo graphics (p10..p13) + the 2 text promos.
    const withVisual = s.scoreAnalysis(input({
      mediaLabels: [10, 11, 12, 13].map((i) => ({ postId: `p${i}`, kind: "promo_graphic" })),
    })).scores.components.paid_promo_risk;
    ck(`visual-only promos raise risk (${textOnly.value} -> ${withVisual.value})`, withVisual.value > textOnly.value);
    ck("visual shilling named in reasons", withVisual.reasons.some((r) => r.includes("promo GRAPHICS under non-promotional text")));
    ck("saturation counts 6/20", withVisual.reasons.some((r) => r.includes("6/20")));
  }
  // --- 2. no double-counting ---------------------------------------------------
  {
    const graphicOnPromoPost = s.scoreAnalysis(input({
      mediaLabels: [{ postId: "p0", kind: "promo_graphic" }], // p0 is already isPromo
    })).scores.components.paid_promo_risk;
    const textOnly = s.scoreAnalysis(input()).scores.components.paid_promo_risk;
    ck("promo graphic on an already-promo post does not double-count", graphicOnPromoPost.value === textOnly.value);
  }
  // --- 3. media profile reason --------------------------------------------------
  {
    const cf = s.scoreAnalysis(input({
      mediaLabels: [
        { postId: "p2", kind: "chart_or_data" }, { postId: "p3", kind: "chart_or_data" },
        { postId: "p4", kind: "screenshot_text" }, { postId: "p5", kind: "meme" },
      ],
    })).scores.components.content_fit;
    ck("media profile appended to content_fit reasons", cf.reasons.some((r) => r.includes("Visual content across 4 labeled image(s)")));
    ck("profile shares correct (75% substantive, 25% memes)", cf.reasons.some((r) => r.includes("75% charts/data/analysis") && r.includes("25% memes")));
  }
  // --- 4. absent labels = byte-identical ----------------------------------------
  {
    const a = s.scoreAnalysis(input({ mediaLabels: [] }));
    const b = s.scoreAnalysis(input({ mediaLabels: undefined }));
    ck("no media labels -> identical scores (empty vs absent)", JSON.stringify(a) === JSON.stringify(b));
    ck("no media reason emitted", !a.scores.components.content_fit.reasons.some((r) => r.includes("Visual content")));
    ck("deterministic", JSON.stringify(s.scoreAnalysis(input())) === JSON.stringify(s.scoreAnalysis(input())));
  }
  // --- 5. raised default image limit --------------------------------------------
  ck("DEFAULT_MEDIA_IMAGE_LIMIT raised to 16", llm.OpenAiLlmProvider && require("../../packages/llm/dist/openai/provider.js").DEFAULT_MEDIA_IMAGE_LIMIT === 16);

  console.log(`\nMEDIA SCORING REGRESSION (31): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
