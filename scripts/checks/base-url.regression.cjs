// Regression check for the Unit 18 live-run bug: an empty `*_BASE_URL` env var
// must NOT produce a relative request URL. Previously `resolveBaseUrl` used `??`,
// which kept an empty string from `.env` (shipped empty in .env.example) and made
// every request path relative → `fetch` threw "Failed to parse URL".
//
// Run after `pnpm build`:  node scripts/checks/base-url.regression.cjs
// (or `pnpm check:base-url`). Uses injected fetch — no network, no keys, no cost.

const tw = require("../../packages/twitter/dist/index.js");
const llm = require("../../packages/llm/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

const jsonResp = (obj) =>
  new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json" } });

(async () => {
  // Reproduce the exact broken condition: base-url env vars present but EMPTY.
  const capture = () => { const r = { url: "" }; r.fetch = async (u) => { r.url = u; return r.resp; }; return r; };

  // --- TwitterAPI.io provider ---
  for (const val of ["", "   "]) {
    process.env.TWITTERAPI_IO_BASE_URL = val;
    const c = capture();
    c.resp = jsonResp({ data: null, status: "error", msg: "x" });
    const p = tw.createTwitterApiProvider({ apiKey: "k", fetchImpl: c.fetch });
    await p.getUserProfile("acme");
    ck(
      `twitter: absolute URL when TWITTERAPI_IO_BASE_URL=${JSON.stringify(val)} (${c.url.slice(0, 42)}…)`,
      c.url.startsWith("https://api.twitterapi.io/twitter/user/info")
    );
  }

  // --- OpenAI provider ---
  process.env.OPENAI_BASE_URL = "";
  const oc = capture();
  oc.resp = jsonResp({
    output_text: JSON.stringify({
      productCategory: null, targetUser: null, stage: null, campaignGoal: null,
      region: null, keywords: [], confidence: "low",
    }),
    usage: {},
  });
  const oa = llm.createOpenAiLlmProvider({ apiKey: "k", model: "m", maxRetries: 0, fetchImpl: oc.fetch });
  await oa.classifyOrgProfile({ handle: "acme", profile: null });
  ck(
    `openai: absolute URL when OPENAI_BASE_URL="" (${oc.url})`,
    oc.url === "https://api.openai.com/v1/responses"
  );

  console.log(`\nBASE-URL REGRESSION: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
