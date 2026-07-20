// Regression: audience-donut segment folding. A donut stops being readable past
// ~6 slices, so the 15-bucket taxonomy is folded before it is drawn. This pins
// the budget math and the guarantee that folding never loses a number.
//
// Run after `pnpm build`:  node scripts/checks/audience-segments.regression.cjs
// (or `pnpm check:audience-segments`). Offline — no network, no keys, no DB.

const {
  foldAudienceSegments,
  AUDIENCE_MAX_SEGMENTS,
  AUDIENCE_OTHER_KEY,
  AUDIENCE_LOW_QUALITY_KEY,
  AUDIENCE_CRYPTO_NATIVE_KEY,
} = require("../../packages/shared/dist/index.js");

let pass = 0,
  fail = 0;
const ck = (n, c) => {
  console.log((c ? "OK   " : "FAIL ") + n);
  c ? pass++ : fail++;
};

const b = (pairs) => ({
  buckets: Object.fromEntries(
    pairs.map(([k, share, count]) => [k, { share, count: count ?? Math.round(share * 100) }])
  ),
});
const keys = (segs) => segs.map((s) => s.key);
const total = (segs) => segs.reduce((a, s) => a + s.share, 0);
const near = (a, x) => Math.abs(a - x) < 1e-9;

// --- the readability cap ---------------------------------------------------
const many = b([
  ["developers", 0.2], ["founders", 0.15], ["traders", 0.12], ["defi_users", 0.1],
  ["investors_vcs", 0.08], ["nft_gaming", 0.07], ["meme_degens", 0.06],
  ["ai_crypto", 0.05], ["infra_research", 0.04], ["community_managers", 0.03],
  ["non_crypto", 0.02], ["bots_spam", 0.05], ["airdrop_farmers", 0.02],
  ["giveaway_hunters", 0.01],
]);
const manySegs = foldAudienceSegments(many);
ck("never exceeds the segment cap", manySegs.length <= AUDIENCE_MAX_SEGMENTS);
ck("share is conserved through folding", near(total(manySegs), total(Object.values(many.buckets).map((v) => ({ share: v.share })))));
ck("Other and Low-quality sort last", keys(manySegs).slice(-2).join() === [AUDIENCE_OTHER_KEY, AUDIENCE_LOW_QUALITY_KEY].join());
ck("biggest bucket keeps its own slice", keys(manySegs)[0] === "developers");
ck("shown buckets are share-ordered", manySegs[0].share >= manySegs[1].share);

// --- low-quality merges into exactly one slice ------------------------------
const low = manySegs.find((s) => s.key === AUDIENCE_LOW_QUALITY_KEY);
ck("low-quality merges to one slice", !!low && low.low === true);
ck("low-quality sums its members", near(low.share, 0.05 + 0.02 + 0.01));
ck("low-quality names its members", low.members.length === 3);
ck("only the low-quality slice is flagged low", manySegs.filter((s) => s.low).length === 1);

// --- folding never loses a number ------------------------------------------
const other = manySegs.find((s) => s.key === AUDIENCE_OTHER_KEY);
ck("Other names every bucket it swallowed", other.members.length > 0);
ck("Other sums its members", other.share > 0);
ck(
  "no bucket is silently dropped",
  manySegs.reduce((a, s) => a + (s.members ? s.members.length : 1), 0) ===
    Object.keys(many.buckets).length
);

// --- small distributions are left alone ------------------------------------
const few = b([["developers", 0.6], ["founders", 0.4]]);
const fewSegs = foldAudienceSegments(few);
ck("no Other slice when nothing overflows", !keys(fewSegs).includes(AUDIENCE_OTHER_KEY));
ck("small distribution renders every bucket", fewSegs.length === 2);
ck("no low-quality slice when there is none", !keys(fewSegs).includes(AUDIENCE_LOW_QUALITY_KEY));

// --- boundaries -------------------------------------------------------------
ck("empty distribution -> no segments", foldAudienceSegments({ buckets: {} }).length === 0);
ck("zero-share buckets are excluded", foldAudienceSegments(b([["developers", 1], ["founders", 0]])).length === 1);

// Exactly at budget with low-quality present: 5 main + 1 low = 6, no fold.
const exact = b([
  ["developers", 0.3], ["founders", 0.2], ["traders", 0.15], ["defi_users", 0.1],
  ["investors_vcs", 0.05], ["bots_spam", 0.2],
]);
const exactSegs = foldAudienceSegments(exact);
ck("exactly at the cap does not fold", exactSegs.length === AUDIENCE_MAX_SEGMENTS && !keys(exactSegs).includes(AUDIENCE_OTHER_KEY));

// One over budget: the tail folds and the cap still holds.
const over = b([
  ["developers", 0.3], ["founders", 0.2], ["traders", 0.15], ["defi_users", 0.1],
  ["investors_vcs", 0.05], ["nft_gaming", 0.02], ["bots_spam", 0.18],
]);
const overSegs = foldAudienceSegments(over);
ck("one over the cap folds the tail", overSegs.length === AUDIENCE_MAX_SEGMENTS && keys(overSegs).includes(AUDIENCE_OTHER_KEY));

// All low-quality: a single merged slice, no empty Other.
const allLow = b([["bots_spam", 0.5], ["airdrop_farmers", 0.5]]);
const allLowSegs = foldAudienceSegments(allLow);
ck("all-low-quality -> one slice", allLowSegs.length === 1 && allLowSegs[0].key === AUDIENCE_LOW_QUALITY_KEY);

// A pathological cap must not produce a chart of pure "Other".
ck("cap of 1 still shows a real bucket", foldAudienceSegments(many, { maxSegments: 1 }).some((s) => s.key !== AUDIENCE_OTHER_KEY));

// --- the outside-crypto slice is never a black hole (Unit 42) ---------------
// `non_crypto` is the one bucket defined by negation. A crypto brand keeps it as
// a single slice but must still be able to see what it is made of; a non-crypto
// brand gets it opened up and the crypto-only buckets folded away instead.
const withOutside = b([
  ["developers", 0.2], ["founders", 0.1], ["traders", 0.1], ["defi_users", 0.1],
  ["non_crypto", 0.5],
]);
// 50 accounts outside crypto: 25 AI/ML, 15 software, 10 unclear.
const domains = {
  total: 50,
  domains: {
    ai_ml: { count: 25, share: 0.5 },
    software_tech: { count: 15, share: 0.3 },
    unknown: { count: 10, share: 0.2 },
  },
};

const cryptoBrand = foldAudienceSegments(withOutside, { domains, cryptoNative: true });
const outsideSlice = cryptoBrand.find((s) => s.key === "non_crypto");
ck("crypto brand keeps one outside-crypto slice", !!outsideSlice);
ck("outside-crypto slice says what it is made of", outsideSlice.members.length === 3);
ck(
  "member shares are rescaled to the whole sample",
  // 50% of the sample is outside crypto; half of THOSE are AI/ML -> 25% overall.
  near(outsideSlice.members[0].share, 0.25) && outsideSlice.members[0].label === "AI / ML"
);
ck(
  "members sum back to the slice",
  near(outsideSlice.members.reduce((a, m) => a + m.share, 0), outsideSlice.share)
);

const otherBrand = foldAudienceSegments(withOutside, { domains, cryptoNative: false });
const otherKeys = keys(otherBrand);
ck("non-crypto brand gets real domain slices", otherKeys.includes("domain:ai_ml"));
ck("non-crypto brand keeps ROLE buckets visible", otherKeys.includes("developers") && otherKeys.includes("founders"));
ck("crypto-only buckets fold into one named slice", otherKeys.includes(AUDIENCE_CRYPTO_NATIVE_KEY));
const cn = otherBrand.find((s) => s.key === AUDIENCE_CRYPTO_NATIVE_KEY);
ck("the crypto fold sums its members", near(cn.share, 0.2) && cn.members.length === 2);
ck("the crypto fold is not labelled 'Other'", cn.label === "Crypto-native");
ck("share is conserved in the non-crypto layout", near(total(otherBrand), 1));
ck("non-crypto layout still respects the cap", otherBrand.length <= AUDIENCE_MAX_SEGMENTS);

// Defaults and degradation: a pre-v4 report has no domains to open the slice
// into, so it must fall back to the crypto-native layout rather than inventing
// or dropping a slice.
ck(
  "defaults to the crypto-native layout",
  keys(foldAudienceSegments(withOutside)).join() === keys(foldAudienceSegments(withOutside, { cryptoNative: true })).join()
);
const noDomains = foldAudienceSegments(withOutside, { cryptoNative: false });
ck("no domain data -> falls back, keeps the bucket", keys(noDomains).includes("non_crypto"));
ck("no domain data -> share still conserved", near(total(noDomains), 1));
ck(
  "empty outside-crypto bucket does not fabricate a slice",
  !keys(foldAudienceSegments(b([["developers", 1]]), { domains: { total: 0, domains: {} }, cryptoNative: false })).some((k) => k.startsWith("domain:"))
);

console.log(`\nAUDIENCE SEGMENTS REGRESSION: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
