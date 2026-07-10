// Regression check for Unit 21 (Error Handling): classifyAnalysisError maps
// TwitterApiError / OpenAiError codes -> stable user-facing codes with fixed,
// safe messages, and never echoes the raw error text (no secret leakage).
//
// Run after `pnpm build`:  node scripts/checks/error-taxonomy.regression.cjs
// (or `pnpm check:error-taxonomy`). No network, no DB, no keys.

const { classifyAnalysisError } = require("../../apps/worker/dist/errors.js");
const { TwitterApiError } = require("../../packages/twitter/dist/index.js");
const { OpenAiError } = require("../../packages/llm/dist/index.js");

let pass = 0,
  fail = 0;
const ck = (n, c) => {
  console.log((c ? "OK   " : "FAIL ") + n);
  c ? pass++ : fail++;
};

const twCases = [
  ["auth_error", "twitter_auth"],
  ["rate_limited", "twitter_rate_limited"],
  ["not_found", "twitter_not_found"],
  ["timeout", "twitter_timeout"],
  ["network_error", "twitter_unavailable"],
  ["provider_error", "twitter_unavailable"],
  ["invalid_response", "twitter_unavailable"],
];
for (const [inCode, outCode] of twCases) {
  const r = classifyAnalysisError(new TwitterApiError(inCode, "raw provider text"));
  ck(`twitter ${inCode} -> ${outCode} (got ${r.code})`, r.code === outCode && typeof r.message === "string" && r.message.length > 0);
}

const llmCases = [
  ["auth_error", "llm_auth"],
  ["rate_limited", "llm_rate_limited"],
  ["invalid_response", "llm_invalid_output"],
  ["refusal", "llm_invalid_output"],
  ["timeout", "llm_timeout"],
  ["config_error", "llm_config"],
  ["network_error", "llm_unavailable"],
  ["provider_error", "llm_unavailable"],
];
for (const [inCode, outCode] of llmCases) {
  const r = classifyAnalysisError(new OpenAiError(inCode, "raw provider text"));
  ck(`llm ${inCode} -> ${outCode} (got ${r.code})`, r.code === outCode && typeof r.message === "string" && r.message.length > 0);
}

// Unknown / non-provider errors -> analysis_failed
ck("plain Error -> analysis_failed", classifyAnalysisError(new Error("boom")).code === "analysis_failed");
ck("non-Error value -> analysis_failed", classifyAnalysisError("nope").code === "analysis_failed");
ck("null -> analysis_failed", classifyAnalysisError(null).code === "analysis_failed");

// Unknown provider sub-code falls back to *_unavailable, not a crash.
ck("unknown twitter code -> twitter_unavailable", classifyAnalysisError(new TwitterApiError("weird_code", "x")).code === "twitter_unavailable");
ck("unknown llm code -> llm_unavailable", classifyAnalysisError(new OpenAiError("weird_code", "x")).code === "llm_unavailable");

// No secret leakage: the raw message text must never appear in the output.
const leaky = new OpenAiError("provider_error", "key=SECRET_ABC123 leaked in body");
const out = classifyAnalysisError(leaky);
ck("classified message does not contain raw secret text", !out.message.includes("SECRET_ABC123"));

// Structural fallback (cross-realm): a plain object shaped like the error.
const structural = { name: "TwitterApiError", code: "not_found", message: "x" };
ck("structural TwitterApiError-like -> twitter_not_found", classifyAnalysisError(structural).code === "twitter_not_found");

console.log(`\nERROR TAXONOMY REGRESSION: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
