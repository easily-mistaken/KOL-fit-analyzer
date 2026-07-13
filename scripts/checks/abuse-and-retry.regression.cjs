// Regression check for Unit 26 (Abuse & Cost Controls):
//   - resolveAbuseLimits() applies env overrides on top of the defaults, with
//     the correct validity rules (positive-int count caps; >= 0 spend cap).
//   - isRetryable() / decideRetry() classify transient vs terminal failures and
//     respect the attempts/maxAttempts budget; RETRYABLE_CODES is exactly the
//     six expected codes.
//
// Run after `pnpm build`:  node scripts/checks/abuse-and-retry.regression.cjs
// (or `pnpm check:abuse-and-retry`). No network, no DB, no keys.

const { resolveAbuseLimits } = require("../../packages/shared/dist/index.js");
const {
  isRetryable,
  decideRetry,
  RETRYABLE_CODES,
} = require("../../apps/worker/dist/errors.js");

let pass = 0,
  fail = 0;
const ck = (n, c) => {
  console.log((c ? "OK   " : "FAIL ") + n);
  c ? pass++ : fail++;
};

// --- resolveAbuseLimits ----------------------------------------------------

// Defaults when env is empty.
const def = resolveAbuseLimits({});
ck(`default perOwnerPerDay = 10 (got ${def.perOwnerPerDay})`, def.perOwnerPerDay === 10);
ck(`default globalPerDay = 200 (got ${def.globalPerDay})`, def.globalPerDay === 200);
ck(`default maxDailySpendUsd = 0 (got ${def.maxDailySpendUsd})`, def.maxDailySpendUsd === 0);

// Env overrides applied.
const ov = resolveAbuseLimits({
  MAX_ANALYSES_PER_OWNER_PER_DAY: "3",
  MAX_ANALYSES_PER_DAY: "50",
  MAX_DAILY_SPEND_USD: "25.5",
});
ck(`override perOwnerPerDay -> 3 (got ${ov.perOwnerPerDay})`, ov.perOwnerPerDay === 3);
ck(`override globalPerDay -> 50 (got ${ov.globalPerDay})`, ov.globalPerDay === 50);
ck(`override maxDailySpendUsd -> 25.5 (got ${ov.maxDailySpendUsd})`, ov.maxDailySpendUsd === 25.5);

// Invalid / negative count env -> default.
const bad = resolveAbuseLimits({
  MAX_ANALYSES_PER_OWNER_PER_DAY: "0",
  MAX_ANALYSES_PER_DAY: "-5",
  MAX_DAILY_SPEND_USD: "-1",
});
ck(`count env 0 -> default 10 (got ${bad.perOwnerPerDay})`, bad.perOwnerPerDay === 10);
ck(`count env -5 -> default 200 (got ${bad.globalPerDay})`, bad.globalPerDay === 200);
ck(`spend env -1 -> default 0 (got ${bad.maxDailySpendUsd})`, bad.maxDailySpendUsd === 0);

const junk = resolveAbuseLimits({
  MAX_ANALYSES_PER_OWNER_PER_DAY: "abc",
  MAX_ANALYSES_PER_DAY: "",
  MAX_DAILY_SPEND_USD: "xyz",
});
ck(`count env non-numeric -> default 10 (got ${junk.perOwnerPerDay})`, junk.perOwnerPerDay === 10);
ck(`count env empty -> default 200 (got ${junk.globalPerDay})`, junk.globalPerDay === 200);
ck(`spend env non-numeric -> default 0 (got ${junk.maxDailySpendUsd})`, junk.maxDailySpendUsd === 0);

// MAX_DAILY_SPEND_USD=0 stays 0 (disabled); a valid positive override applies.
ck(
  `spend env "0" stays 0 (disabled)`,
  resolveAbuseLimits({ MAX_DAILY_SPEND_USD: "0" }).maxDailySpendUsd === 0
);
ck(
  `spend env "100" applies`,
  resolveAbuseLimits({ MAX_DAILY_SPEND_USD: "100" }).maxDailySpendUsd === 100
);

// --- RETRYABLE_CODES / isRetryable / decideRetry ---------------------------

const RETRYABLE = [
  "twitter_rate_limited",
  "twitter_timeout",
  "twitter_unavailable",
  "llm_rate_limited",
  "llm_timeout",
  "llm_unavailable",
];
const TERMINAL = [
  "twitter_auth",
  "twitter_not_found",
  "llm_auth",
  "llm_config",
  "llm_invalid_output",
  "analysis_failed",
];

// RETRYABLE_CODES contains exactly the six expected codes.
ck(`RETRYABLE_CODES has 6 entries (got ${RETRYABLE_CODES.size})`, RETRYABLE_CODES.size === 6);
ck(
  "RETRYABLE_CODES == expected set",
  RETRYABLE.every((c) => RETRYABLE_CODES.has(c))
);

for (const code of RETRYABLE) {
  ck(`isRetryable(${code}) true`, isRetryable(code) === true);
  ck(
    `decideRetry(${code}, attempts 1/3) retry true`,
    decideRetry({ code, attempts: 1, maxAttempts: 3 }).retry === true
  );
}

for (const code of TERMINAL) {
  ck(`isRetryable(${code}) false`, isRetryable(code) === false);
  ck(
    `decideRetry(${code}, attempts 1/3) retry false`,
    decideRetry({ code, attempts: 1, maxAttempts: 3 }).retry === false
  );
}

// attempts === maxAttempts -> exhausted -> false, even for a retryable code.
ck(
  "decideRetry(retryable, attempts 3/3) retry false (exhausted)",
  decideRetry({ code: "twitter_timeout", attempts: 3, maxAttempts: 3 }).retry === false
);
// attempts > maxAttempts -> false.
ck(
  "decideRetry(retryable, attempts 4/3) retry false",
  decideRetry({ code: "twitter_timeout", attempts: 4, maxAttempts: 3 }).retry === false
);
// attempts < maxAttempts for a retryable code -> true (sanity, non-1 attempt).
ck(
  "decideRetry(retryable, attempts 2/3) retry true",
  decideRetry({ code: "llm_unavailable", attempts: 2, maxAttempts: 3 }).retry === true
);

console.log(`\nABUSE & RETRY REGRESSION: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
