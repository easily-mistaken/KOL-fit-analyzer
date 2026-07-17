// Regression: instant-reuse window resolution (Unit 41). A repeat submit of the
// same brand × creator + brief is served from the prior completed report when it
// is newer than this window. This pins the env-resolution contract: default,
// override, the `0`-disables sentinel, and invalid-input fallback.
//
// Run after `pnpm build`:  node scripts/checks/analysis-reuse.regression.cjs
// (or `pnpm check:analysis-reuse`). Offline — no network, no keys, no DB.

const {
  resolveReuseWindowSeconds,
  REUSE_WINDOW_SECONDS_DEFAULT,
  REUSE_WINDOW_ENV_VAR,
} = require("../../packages/shared/dist/index.js");

let pass = 0,
  fail = 0;
const ck = (n, c) => {
  console.log((c ? "OK   " : "FAIL ") + n);
  c ? pass++ : fail++;
};

const V = REUSE_WINDOW_ENV_VAR;
const w = (val) => resolveReuseWindowSeconds(val === undefined ? {} : { [V]: val });

// --- the default -----------------------------------------------------------
ck("default is 30 days", REUSE_WINDOW_SECONDS_DEFAULT === 2592000);
ck("absent env -> default", w(undefined) === REUSE_WINDOW_SECONDS_DEFAULT);
ck("empty string -> default", w("") === REUSE_WINDOW_SECONDS_DEFAULT);
ck("whitespace -> default", w("   ") === REUSE_WINDOW_SECONDS_DEFAULT);

// --- valid overrides -------------------------------------------------------
ck("positive integer honored", w("3600") === 3600);
ck("7 days honored", w("604800") === 604800);
ck("float is truncated", w("3600.9") === 3600);

// --- the disable sentinel --------------------------------------------------
ck("0 disables (returns 0, not default)", w("0") === 0);

// --- invalid input falls back to default -----------------------------------
ck("non-numeric -> default", w("abc") === REUSE_WINDOW_SECONDS_DEFAULT);
ck("negative -> default", w("-5") === REUSE_WINDOW_SECONDS_DEFAULT);
ck("NaN-ish -> default", w("1e") === REUSE_WINDOW_SECONDS_DEFAULT);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
