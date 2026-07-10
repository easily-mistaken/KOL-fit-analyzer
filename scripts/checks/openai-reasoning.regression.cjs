// Regression check for the Unit 18 live-run OpenAI failure: GPT-5-tier reasoning
// models count reasoning against `max_output_tokens`, so with a low budget and
// no reasoning-effort control the response comes back `incomplete` with empty
// output -> "not valid JSON". The provider now sends `reasoning.effort`
// (default "minimal", omittable via OPENAI_REASONING_EFFORT="off"), uses larger
// token budgets, and surfaces `incomplete` clearly.
//
// Run after `pnpm build`:  node scripts/checks/openai-reasoning.regression.cjs
// (or `pnpm check:openai-reasoning`). Injected fetch — no network, no keys.

const llm = require("../../packages/llm/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };
const jsonResp = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json" } });
const ORG_OUT = { productCategory: null, targetUser: null, stage: null, campaignGoal: null, region: null, keywords: [], confidence: "low" };

(async () => {
  delete process.env.OPENAI_REASONING_EFFORT;

  // 1. default -> reasoning.effort:"minimal" + raised max_output_tokens
  let body;
  let p = llm.createOpenAiLlmProvider({ apiKey: "k", model: "gpt-5-mini", maxRetries: 0,
    fetchImpl: async (_u, init) => { body = JSON.parse(init.body); return jsonResp({ output_text: JSON.stringify(ORG_OUT), usage: {} }); } });
  await p.classifyOrgProfile({ handle: "acme", profile: null });
  ck(`default reasoning.effort = "minimal" (${JSON.stringify(body.reasoning)})`, body.reasoning && body.reasoning.effort === "minimal");
  ck(`org max_output_tokens raised (${body.max_output_tokens})`, body.max_output_tokens >= 2000);

  // 2. OPENAI_REASONING_EFFORT=off -> no reasoning param (non-reasoning models)
  process.env.OPENAI_REASONING_EFFORT = "off";
  let body2;
  p = llm.createOpenAiLlmProvider({ apiKey: "k", model: "gpt-4o-mini", maxRetries: 0,
    fetchImpl: async (_u, init) => { body2 = JSON.parse(init.body); return jsonResp({ output_text: JSON.stringify(ORG_OUT), usage: {} }); } });
  await p.classifyOrgProfile({ handle: "acme", profile: null });
  ck('OPENAI_REASONING_EFFORT="off" omits reasoning param', body2.reasoning === undefined);
  delete process.env.OPENAI_REASONING_EFFORT;

  // 3. explicit option override
  let body3;
  p = llm.createOpenAiLlmProvider({ apiKey: "k", model: "m", reasoningEffort: "low", maxRetries: 0,
    fetchImpl: async (_u, init) => { body3 = JSON.parse(init.body); return jsonResp({ output_text: JSON.stringify(ORG_OUT), usage: {} }); } });
  await p.classifyOrgProfile({ handle: "acme", profile: null });
  ck('reasoningEffort option override -> "low"', body3.reasoning && body3.reasoning.effort === "low");

  // 4. incomplete response -> clear typed error (not "not valid JSON")
  p = llm.createOpenAiLlmProvider({ apiKey: "k", model: "m", maxRetries: 0,
    fetchImpl: async () => jsonResp({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [], usage: {} }) });
  let msg = "";
  try { await p.classifyOrgProfile({ handle: "acme", profile: null }); } catch (e) { msg = e.message; }
  ck(`incomplete -> clear error ("${msg.slice(0, 48)}…")`, /incomplete/i.test(msg) && /max_output_tokens/i.test(msg));

  // 5. audience batch size = 40 (Unit 18: 100-account batches timed out)
  {
    let reqs = 0;
    const acct = (i) => ({ user: { id: `u${i}`, handle: `h${i}`, bio: `b${i}`, followersCount: 10 }, tweetId: "t1", source: "REPLY" });
    const modelAccounts = { accounts: Array.from({ length: 40 }, () => ({ accountId: "x", handle: "h", source: "REPLY", bucket: "traders", signals: { botScore: 0.1, emptyBio: false, farmingSignals: [] } })) };
    const p2 = llm.createOpenAiLlmProvider({ apiKey: "k", model: "m", reasoningEffort: "off", maxRetries: 0,
      fetchImpl: async () => { reqs++; return jsonResp({ output_text: JSON.stringify(modelAccounts), usage: {} }); } });
    const accounts = Array.from({ length: 90 }, (_, i) => acct(i));
    const res = await p2.classifyAudienceAccounts({ accounts });
    ck(`audience batched at 40 -> ceil(90/40)=3 requests (got ${reqs})`, reqs === 3);
    ck(`audience distribution.sampleSize = 90 (all classified)`, res.distribution.sampleSize === 90);
  }

  // 6. OPENAI_TIMEOUT_MS is honored (Unit 18: was documented but unwired)
  {
    process.env.OPENAI_TIMEOUT_MS = "50";
    const slow = (_u, init) => new Promise((resolve, reject) => {
      const t = setTimeout(() => resolve(jsonResp({ output_text: JSON.stringify(ORG_OUT), usage: {} })), 500);
      init.signal.addEventListener("abort", () => { clearTimeout(t); const e = new Error("aborted"); e.name = "AbortError"; reject(e); });
    });
    const p3 = llm.createOpenAiLlmProvider({ apiKey: "k", model: "m", maxRetries: 0, fetchImpl: slow });
    let code;
    try { await p3.classifyOrgProfile({ handle: "acme", profile: null }); } catch (e) { code = e.code; }
    ck("OPENAI_TIMEOUT_MS=50 honored (aborts before 500ms mock)", code === "timeout");
    delete process.env.OPENAI_TIMEOUT_MS;
  }

  // 7 + 8. audience schema has NO minimum/maximum (strict-mode 400 fix) and
  //        botScore is clamped to [0,1] (Unit 18: OpenAI 400 on the audience call)
  {
    let auBody;
    const modelAccounts = { accounts: [{ accountId: "x", handle: "h", source: "REPLY", bucket: "traders", signals: { botScore: 1.5, emptyBio: false, farmingSignals: [] } }] };
    const p4 = llm.createOpenAiLlmProvider({ apiKey: "k", model: "m", reasoningEffort: "off", maxRetries: 0,
      fetchImpl: async (_u, init) => { auBody = JSON.parse(init.body); return jsonResp({ output_text: JSON.stringify(modelAccounts), usage: {} }); } });
    const res = await p4.classifyAudienceAccounts({ accounts: [{ user: { id: "u0", handle: "user0", bio: "b", followersCount: 5 }, tweetId: "t1", source: "REPLY" }] });
    ck("audience schema has NO minimum/maximum (strict-mode 400 fix)", !/minimum|maximum/.test(JSON.stringify(auBody.text.format.schema)));
    ck("botScore clamped to [0,1] (1.5 -> 1)", res.accounts[0] && res.accounts[0].signals.botScore === 1);
  }

  // 9. OpenAI error body surfaced in the thrown message (Unit 18: was "HTTP 400" only)
  {
    const p5 = llm.createOpenAiLlmProvider({ apiKey: "k", model: "m", maxRetries: 0,
      fetchImpl: async () => new Response(JSON.stringify({ error: { message: "Invalid schema for response_format 'audience_batch': 'minimum' is not permitted." } }), { status: 400, headers: { "content-type": "application/json" } }) });
    let msg = "";
    try { await p5.classifyOrgProfile({ handle: "a", profile: null }); } catch (e) { msg = e.message; }
    ck(`400 error body surfaced ("${msg.slice(0, 40)}…")`, /HTTP 400/.test(msg) && /not permitted/.test(msg));
  }

  // 10. prompt with an emoji truncated at the boundary has NO unpaired UTF-16
  //     surrogate (Unit 18: caused OpenAI 400 "unpaired surrogate ... invalid UTF-8")
  {
    let body;
    const modelAccounts = { accounts: [{ accountId: "x", handle: "h", source: "REPLY", bucket: "traders", signals: { botScore: 0.1, emptyBio: false, farmingSignals: [] } }] };
    const p6 = llm.createOpenAiLlmProvider({ apiKey: "k", model: "m", reasoningEffort: "off", maxRetries: 0,
      fetchImpl: async (_u, init) => { body = JSON.parse(init.body); return jsonResp({ output_text: JSON.stringify(modelAccounts), usage: {} }); } });
    const bio = "a".repeat(139) + "😀"; // 😀 lands exactly at the 140-char truncation boundary
    await p6.classifyAudienceAccounts({ accounts: [{ user: { id: "u0", handle: "user0", bio, followersCount: 5 }, tweetId: "t1", source: "REPLY" }] });
    const content = body.input[1].content;
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(content);
    ck("prompt has no unpaired UTF-16 surrogate after emoji truncation", !lone);
  }

  console.log(`\nOPENAI PROVIDER REGRESSION: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
