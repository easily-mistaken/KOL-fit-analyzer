// Unit 49 regression: brand-lens audience presentation. Claims under test:
//
//   1. LENS RESOLUTION — crypto target domains read as web3, ai/software as
//      ai, crypto ties win, no signal means neutral (no lens view at all).
//   2. GROUPING — every role x domain cell lands in exactly one group per
//      lens (first match wins, catch-all last), no share is ever dropped:
//      groups + junk sum to ~1 against the classified total.
//   3. IN-WORLD HEADLINE — inWorldShare sums exactly the inWorld groups.
//   4. FALLBACK — no matrix (old reports) degrades to domain-only groups
//      with NO junk segment (domain marginals already include junk).
//
// Run after `pnpm build`:  node scripts/checks/audience-lens.regression.cjs
// (or `pnpm check:audience-lens`). No network, no keys, no DB.

const s = require("../../packages/shared/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

// --- 1. lens resolution -------------------------------------------------------
ck("defi brand -> web3", s.resolveBrandLens(["crypto_defi"], []) === "web3");
ck("ai brand -> ai", s.resolveBrandLens(["ai"], ["software"]) === "ai");
ck("ai primary beats crypto secondary", s.resolveBrandLens(["ai", "software"], ["crypto_infra"]) === "ai");
ck("crypto ties win (crypto-AI brand -> web3)", s.resolveBrandLens(["crypto_infra", "ai"], []) === "web3");
ck("no signal -> neutral", s.resolveBrandLens(["creative"], ["gaming"]) === "neutral");
ck("empty -> neutral", s.resolveBrandLens(undefined, undefined) === "neutral");
ck("world domains: web3 = crypto, ai = tech, neutral = none",
  s.lensWorldDomains("web3").includes("crypto_defi") && s.lensWorldDomains("ai").includes("software") && s.lensWorldDomains("neutral").length === 0);

// --- fixture: 100 classified accounts, 10 junk --------------------------------
// matrix covers the 90 real accounts; shares are over ALL 100.
const MATRIX = {
  "trader/crypto_defi": { count: 20, share: 0.2 },
  "enthusiast/crypto_defi": { count: 10, share: 0.1 },
  "developer/crypto_infra": { count: 15, share: 0.15 },
  "trader/crypto_infra": { count: 5, share: 0.05 },
  "investor/crypto_defi": { count: 8, share: 0.08 },
  "enthusiast/crypto_memecoins": { count: 7, share: 0.07 },
  "developer/ai": { count: 10, share: 0.1 },
  "enthusiast/ai": { count: 5, share: 0.05 },
  "enthusiast/general": { count: 8, share: 0.08 },
  "unknown/unknown": { count: 2, share: 0.02 },
};
const DIST = {
  sampleSize: 100,
  roles: {},
  domains: {
    crypto_defi: { count: 38, share: 0.38 },
    crypto_infra: { count: 20, share: 0.2 },
    crypto_memecoins: { count: 7, share: 0.07 },
    ai: { count: 15, share: 0.15 },
    general: { count: 10, share: 0.1 },
    unknown: { count: 10, share: 0.1 },
  },
  quality: {
    real: { count: 90, share: 0.9 },
    bot: { count: 6, share: 0.06 },
    farmer: { count: 3, share: 0.03 },
    giveaway_hunter: { count: 1, share: 0.01 },
  },
};

// --- 2 + 3. joint grouping, web3 lens ----------------------------------------
{
  const v = s.buildLensView({ lens: "web3", distribution: DIST, matrix: MATRIX });
  const g = Object.fromEntries(v.groups.map((x) => [x.key, x]));
  ck("joint path used", v.joint === true);
  ck("defi trader + enthusiast -> DeFi traders and users (30%)", near(g.defi_traders?.share, 0.3));
  ck("developer x crypto_infra -> crypto builders", near(g.crypto_builders?.share, 0.15));
  ck("trader x crypto_infra -> other crypto natives, NOT outside", near(g.crypto_other?.share, 0.05));
  ck("investor x crypto_defi -> crypto capital", near(g.crypto_capital?.share, 0.08));
  ck("memecoin crowd grouped", near(g.degens?.share, 0.07));
  ck("ai accounts -> tech crossover (out of world)", near(g.tech_crossover?.share, 0.15) && g.tech_crossover.inWorld === false);
  ck("general + unknown -> outside", near(g.outside?.share, 0.1));
  ck("junk segment present (10%)", near(g.low_quality?.share, 0.1) && g.low_quality.inWorld === false);
  const total = v.groups.reduce((a, x) => a + x.share, 0);
  ck(`no share dropped (groups sum to 1, got ${total.toFixed(3)})`, near(total, 1));
  ck("inWorldShare = crypto groups (65%)", near(v.inWorldShare, 0.65));
  ck("in-world groups come first", v.groups.findIndex((x) => !x.inWorld) > v.groups.filter((x) => x.inWorld).length - 1);
}

// --- same audience, ai lens ---------------------------------------------------
{
  const v = s.buildLensView({ lens: "ai", distribution: DIST, matrix: MATRIX });
  const g = Object.fromEntries(v.groups.map((x) => [x.key, x]));
  ck("developer x ai -> AI builders", near(g.ai_builders?.share, 0.1));
  ck("enthusiast x ai -> AI-curious adopters", near(g.ai_curious?.share, 0.05));
  ck("crypto devs/founders -> crypto-native builders (out of world)", near(g.crypto_native?.share, 0.15) && g.crypto_native.inWorld === false);
  ck("ai lens inWorldShare = 15%", near(v.inWorldShare, 0.15));
  const total = v.groups.reduce((a, x) => a + x.share, 0);
  ck(`ai lens also conserves share (${total.toFixed(3)})`, near(total, 1));
}

// --- 4. fallback + neutral ----------------------------------------------------
{
  ck("neutral lens -> null", s.buildLensView({ lens: "neutral", distribution: DIST, matrix: MATRIX }) === null);
  ck("empty sample -> null", s.buildLensView({ lens: "web3", distribution: { ...DIST, sampleSize: 0 }, matrix: MATRIX }) === null);
  const v = s.buildLensView({ lens: "web3", distribution: DIST });
  ck("no matrix -> domain-only fallback", v.joint === false);
  const g = Object.fromEntries(v.groups.map((x) => [x.key, x]));
  ck("fallback groups by domain (DeFi 38%)", near(g.defi?.share, 0.38));
  ck("fallback has NO junk segment (marginals already include junk)", !g.low_quality);
  const total = v.groups.reduce((a, x) => a + x.share, 0);
  ck(`fallback conserves the domain marginals (${total.toFixed(3)})`, near(total, 1));
  ck("fallback headline = crypto domains (65%)", near(v.inWorldShare, 0.65));
}

console.log(`\nAUDIENCE LENS REGRESSION (49): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
