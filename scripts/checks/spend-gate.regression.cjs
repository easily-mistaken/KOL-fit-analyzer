// Unit 50 regression: the daily spend gate must never be dead config again.
// MAX_DAILY_SPEND_USD sums ProviderUsageLog.costUsd; this pins the two things
// that make costUsd real: Twitter cost estimation has WORKING DEFAULTS baked
// into code (no env required), and the estimation math matches twitterapi.io's
// published pricing shape (per-1k tweets + per-1k profiles + per-call minimum,
// added on top so a cap-relevant estimate errs high, never low).
//
// Run after `pnpm build`:  node scripts/checks/spend-gate.regression.cjs
// (or `pnpm check:spend-gate`). No network, no keys, no DB.

const s = require("../../packages/shared/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

// --- defaults exist in code (dead-config-proof) -------------------------------
{
  const r = s.resolveTwitterCostRates({});
  ck("empty env -> real default rates (0.15 / 0.18 / 0.00015)",
    near(r.perThousandTweets, 0.15) && near(r.perThousandProfiles, 0.18) && near(r.minPerRequest, 0.00015));
  const o = s.resolveTwitterCostRates({ TWITTERAPI_COST_PER_1K_TWEETS: "0.2", TWITTERAPI_MIN_COST_PER_REQUEST: "0" });
  ck("env overrides honored (0 is valid: disables the minimum)", near(o.perThousandTweets, 0.2) && near(o.minPerRequest, 0));
  const g = s.resolveTwitterCostRates({ TWITTERAPI_COST_PER_1K_TWEETS: "garbage", TWITTERAPI_COST_PER_1K_PROFILES: "-1" });
  ck("garbage/negative env -> defaults", near(g.perThousandTweets, 0.15) && near(g.perThousandProfiles, 0.18));
}

// --- estimation math ----------------------------------------------------------
{
  // Shaped like a real fresh-creator run (the 2026-07-23 _woofi x
  // thedefinvestor run logged 148 requests); round numbers keep the
  // expectation auditable by eye.
  const cost = s.estimateTwitterCostUsd({ requests: 100, tweetsFetched: 1000, usersFetched: 500 });
  ck(`typical fresh-creator run ~ $0.26 (got ${cost.toFixed(4)})`, near(cost, 0.15 + 0.09 + 0.015));
  ck("zero usage -> $0", s.estimateTwitterCostUsd({ requests: 0, tweetsFetched: 0, usersFetched: 0 }) === 0);
  ck("null/missing counters -> $0, never NaN", s.estimateTwitterCostUsd({}) === 0 && s.estimateTwitterCostUsd({ requests: null, tweetsFetched: null, usersFetched: null }) === 0);
  ck("cache-hit run (1 request, nothing fetched) costs only the minimum",
    near(s.estimateTwitterCostUsd({ requests: 1, tweetsFetched: 0, usersFetched: 0 }), 0.00015));
  const custom = s.estimateTwitterCostUsd({ requests: 10, tweetsFetched: 100, usersFetched: 0 }, { perThousandTweets: 1, perThousandProfiles: 1, minPerRequest: 0.01 });
  ck("custom rates flow through", near(custom, 0.1 + 0.1));
}

// --- the gate itself stays wired ----------------------------------------------
{
  const lim = s.resolveAbuseLimits({ MAX_DAILY_SPEND_USD: "25" });
  ck("MAX_DAILY_SPEND_USD env resolves (25)", near(lim.maxDailySpendUsd, 25));
  ck("unset spend cap stays disabled (0), not defaulted on", near(s.resolveAbuseLimits({}).maxDailySpendUsd, 0));
}

console.log(`\nSPEND GATE REGRESSION (50): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
