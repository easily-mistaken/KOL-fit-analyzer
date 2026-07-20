// Regression: audience chart segment folding. A donut stops being readable past
// ~6 slices, so an axis is folded before it is drawn. This pins the budget math
// and the guarantee that folding never loses a number.
//
// Unit 43 made the fold AXIS-AGNOSTIC. It used to fold one flat bucket list and
// needed two special cases for values that were not really categories: a
// reserved low-quality slice, and a brand-dependent expansion of the old
// negation-defined bucket.
// Splitting role / domain / quality deleted both — quality is its own axis with
// its own display, and "not crypto" is no longer a value, just any domain that
// isn't a crypto one. These tests cover what survived: rank, keep, fold, and
// never drop share.
//
// Run after `pnpm build`:  node scripts/checks/audience-segments.regression.cjs
// (or `pnpm check:audience-segments`). Offline — no network, no keys, no DB.

const {
  foldSegments,
  foldDomainSegments,
  foldRoleSegments,
  AUDIENCE_MAX_SEGMENTS,
  AUDIENCE_OTHER_KEY,
  AUDIENCE_DOMAIN_LABELS,
  AUDIENCE_ROLE_LABELS,
} = require("../../packages/shared/dist/index.js");

let pass = 0,
  fail = 0;
const ck = (n, c) => {
  console.log((c ? "OK   " : "FAIL ") + n);
  c ? pass++ : fail++;
};

/** {key: share} -> a distribution record, counts derived. */
const rec = (pairs) =>
  Object.fromEntries(
    pairs.map(([k, share, count]) => [
      k,
      { share, count: count ?? Math.round(share * 100) },
    ])
  );
const keys = (segs) => segs.map((s) => s.key);
const total = (segs) => segs.reduce((a, s) => a + s.share, 0);
const near = (a, x) => Math.abs(a - x) < 1e-9;

// --- the readability cap ---------------------------------------------------
const many = rec([
  ["crypto_defi", 0.2], ["ai", 0.15], ["software", 0.12], ["crypto_infra", 0.1],
  ["finance", 0.08], ["crypto_nft_gaming", 0.07], ["crypto_memecoins", 0.06],
  ["creative", 0.05], ["gaming", 0.04], ["science", 0.03],
  ["culture", 0.05], ["news_politics", 0.02], ["general", 0.02], ["unknown", 0.01],
]);
const manySegs = foldSegments(many, AUDIENCE_DOMAIN_LABELS);
ck("never exceeds the segment cap", manySegs.length <= AUDIENCE_MAX_SEGMENTS);
ck("share is conserved through folding", near(total(manySegs), total(Object.values(many))));
ck("Other sorts last", keys(manySegs)[manySegs.length - 1] === AUDIENCE_OTHER_KEY);
ck("biggest value keeps its own slice", keys(manySegs)[0] === "crypto_defi");
ck("shown values are share-ordered", manySegs[0].share >= manySegs[1].share);

// --- folding never loses a number ------------------------------------------
const other = manySegs.find((s) => s.key === AUDIENCE_OTHER_KEY);
ck("Other names every value it swallowed", other.members.length > 0);
ck("Other sums its members", near(other.share, other.members.reduce((a, m) => a + m.share, 0)));
ck(
  "no value is silently dropped",
  manySegs.reduce((a, s) => a + (s.members ? s.members.length : 1), 0) ===
    Object.keys(many).length
);
ck("Other's members are share-ordered", other.members[0].share >= other.members[1].share);

// --- labels ----------------------------------------------------------------
ck("segments carry human labels", manySegs[0].label === AUDIENCE_DOMAIN_LABELS.crypto_defi);
ck(
  "an unlabelled value still renders (never dropped)",
  foldSegments(rec([["not_a_real_domain", 1]]), AUDIENCE_DOMAIN_LABELS)[0].label ===
    "not_a_real_domain"
);

// --- small distributions are left alone ------------------------------------
const few = rec([["ai", 0.6], ["software", 0.4]]);
const fewSegs = foldSegments(few, AUDIENCE_DOMAIN_LABELS);
ck("no Other slice when nothing overflows", !keys(fewSegs).includes(AUDIENCE_OTHER_KEY));
ck("small distribution renders every value", fewSegs.length === 2);

// --- boundaries -------------------------------------------------------------
ck("empty distribution -> no segments", foldSegments({}, AUDIENCE_DOMAIN_LABELS).length === 0);
ck("undefined record -> no segments", foldSegments(undefined, AUDIENCE_DOMAIN_LABELS).length === 0);
ck(
  "zero-share values are excluded",
  foldSegments(rec([["ai", 1], ["software", 0]]), AUDIENCE_DOMAIN_LABELS).length === 1
);

// Exactly at budget: 6 values, no fold.
const exact = rec([
  ["crypto_defi", 0.3], ["ai", 0.2], ["software", 0.15], ["crypto_infra", 0.1],
  ["finance", 0.15], ["gaming", 0.1],
]);
const exactSegs = foldSegments(exact, AUDIENCE_DOMAIN_LABELS);
ck(
  "exactly at the cap does not fold",
  exactSegs.length === AUDIENCE_MAX_SEGMENTS && !keys(exactSegs).includes(AUDIENCE_OTHER_KEY)
);

// One over budget: the tail folds and the cap still holds.
const over = rec([
  ["crypto_defi", 0.3], ["ai", 0.2], ["software", 0.15], ["crypto_infra", 0.1],
  ["finance", 0.13], ["gaming", 0.1], ["science", 0.02],
]);
const overSegs = foldSegments(over, AUDIENCE_DOMAIN_LABELS);
ck(
  "one over the cap folds the tail",
  overSegs.length === AUDIENCE_MAX_SEGMENTS && keys(overSegs).includes(AUDIENCE_OTHER_KEY)
);
ck("one over the cap still conserves share", near(total(overSegs), total(Object.values(over))));

// A pathological cap must not produce a chart of pure "Other".
ck(
  "cap of 1 still shows a real value",
  foldSegments(many, AUDIENCE_DOMAIN_LABELS, 1).some((s) => s.key !== AUDIENCE_OTHER_KEY)
);

// --- the axis helpers read their own axis (Unit 43) -------------------------
// The two rings describe the SAME accounts two different ways, so each helper
// must read only its own record — crossing them would silently render one axis
// with the other's numbers.
{
  const distribution = {
    sampleSize: 100,
    roles: rec([["developer", 0.6], ["founder", 0.4]]),
    domains: rec([["ai", 0.7], ["crypto_infra", 0.3]]),
    quality: rec([["real", 1]]),
  };
  const d = foldDomainSegments(distribution);
  const r = foldRoleSegments(distribution);
  ck("domain helper reads the domain axis", keys(d).join() === "ai,crypto_infra");
  ck("role helper reads the role axis", keys(r).join() === "developer,founder");
  ck("domain helper uses domain labels", d[0].label === AUDIENCE_DOMAIN_LABELS.ai);
  ck("role helper uses role labels", r[0].label === AUDIENCE_ROLE_LABELS.developer);
  ck("both axes sum to the same whole", near(total(d), 1) && near(total(r), 1));
  // A cap of 1 still yields two segments — one real value plus the Other fold —
  // because the floor guarantees a real slice rather than a chart of pure
  // "Other". What the cap bounds is the number of NAMED values.
  const capped = foldDomainSegments(distribution, 1);
  ck(
    "a per-axis cap is honoured",
    capped.filter((s) => s.key !== AUDIENCE_OTHER_KEY).length === 1 &&
      near(total(capped), 1)
  );
}

console.log(`\nAUDIENCE SEGMENTS REGRESSION: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
