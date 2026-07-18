// Unit 34 regression: tiered access funnel. Verifies the pure decideTier
// boundaries (3 anonymous / 12 authenticated, lifetime), env overrides, and
// that the new API error codes exist.
//
// Run after `pnpm build`:  node scripts/checks/tier-gates.regression.cjs
// (or `pnpm check:tier-gates`). Offline — no network, no keys, no DB.

const {
  decideTier,
  resolveTierLimits,
  TIER_LIMITS,
  ApiErrorCodeSchema,
} = require("../../packages/shared/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

// --- defaults ------------------------------------------------------------------
ck("defaults: 3 anonymous / 10 authenticated", TIER_LIMITS.anonLifetime === 3 && TIER_LIMITS.userLifetime === 10);

// --- anonymous boundaries --------------------------------------------------------
ck("anon 0 -> allowed", decideTier(0, false).allowed === true);
ck("anon 2 -> allowed (3rd report)", decideTier(2, false).allowed === true);
ck("anon 3 -> login wall", decideTier(3, false).allowed === false && decideTier(3, false).gate === "login_required");
ck("anon 50 -> login wall", decideTier(50, false).gate === "login_required");

// --- authenticated boundaries ----------------------------------------------------
ck("user 3 -> allowed (claimed history counts, 7 left)", decideTier(3, true).allowed === true);
ck("user 9 -> allowed (10th report)", decideTier(9, true).allowed === true);
ck("user 10 -> upgrade wall", decideTier(10, true).allowed === false && decideTier(10, true).gate === "upgrade_required");
ck("user never sees the login wall", decideTier(999, true).gate === "upgrade_required");

// --- env overrides ---------------------------------------------------------------
const custom = resolveTierLimits({ FREE_TIER_ANON_LIFETIME: "5", FREE_TIER_USER_LIFETIME: "100" });
ck("env overrides apply", custom.anonLifetime === 5 && custom.userLifetime === 100);
ck("override changes the decision", decideTier(3, false, custom).allowed === true && decideTier(5, false, custom).allowed === false);
const bad = resolveTierLimits({ FREE_TIER_ANON_LIFETIME: "-1", FREE_TIER_USER_LIFETIME: "nope" });
ck("invalid overrides fall back to defaults", bad.anonLifetime === 3 && bad.userLifetime === 10);

// --- error codes -----------------------------------------------------------------
ck("login_required is a valid ApiErrorCode", ApiErrorCodeSchema.safeParse("login_required").success);
ck("upgrade_required is a valid ApiErrorCode", ApiErrorCodeSchema.safeParse("upgrade_required").success);

console.log(`\nTIER GATES REGRESSION (34): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
