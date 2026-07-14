#!/usr/bin/env node
// Unit 29E calibration runner. Scores every ground-truth pair in pairs.json
// through the real analysis pipeline and compares the verdict against the
// expected range. Tuning loop: edit packages/scoring/src/weights.ts anchors ->
// `pnpm build` -> `pnpm calibrate` (cache-warm re-runs are near-free).
//
// Usage:
//   pnpm calibrate                 run all pairs (mock providers run freely)
//   pnpm calibrate -- uniswap      only pairs whose handles match "uniswap"
//   pnpm calibrate -- --live       required when TWITTER_PROVIDER/LLM_PROVIDER
//                                  resolve to live providers (BILLABLE)
//   pnpm calibrate -- --selftest   run the expected-matcher self-test only
//
// Results are also written to scripts/calibration/last-run.json (gitignored)
// for diffing between tuning iterations. Exit 1 when any pair misses.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const PAIRS_PATH = path.join(__dirname, "pairs.json");
const LAST_RUN_PATH = path.join(__dirname, "last-run.json");

// --- tiny .env loader (no deps; existing process env wins) -------------------
function loadEnv() {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const [, key, rawVal] = m;
    if (process.env[key] !== undefined) continue;
    const val = rawVal.replace(/^["']|["']$/g, "");
    if (val.length > 0) process.env[key] = val;
  }
}

// --- expected-verdict matcher -------------------------------------------------
const RANK = ["AVOID", "WEAK", "OKAY", "GOOD", "STRONG"];

function matchesExpected(expected, actual) {
  const e = String(expected).trim().toUpperCase();
  if (e.includes("|")) return e.split("|").map((s) => s.trim()).includes(actual);
  if (e.endsWith("+")) return RANK.indexOf(actual) >= RANK.indexOf(e.slice(0, -1));
  if (e.endsWith("-")) return RANK.indexOf(actual) <= RANK.indexOf(e.slice(0, -1));
  return e === actual;
}

function selftest() {
  const cases = [
    ["STRONG", "STRONG", true], ["STRONG", "GOOD", false],
    ["GOOD+", "STRONG", true], ["GOOD+", "GOOD", true], ["GOOD+", "OKAY", false],
    ["WEAK-", "AVOID", true], ["WEAK-", "WEAK", true], ["WEAK-", "OKAY", false],
    ["GOOD|STRONG", "GOOD", true], ["GOOD|STRONG", "OKAY", false],
    ["okay", "OKAY", true],
  ];
  let ok = 0;
  for (const [exp, act, want] of cases) {
    const got = matchesExpected(exp, act);
    console.log(`${got === want ? "OK  " : "FAIL"} matches("${exp}", "${act}") = ${got}`);
    if (got === want) ok++;
  }
  console.log(`\nMATCHER SELFTEST: ${ok}/${cases.length}`);
  process.exit(ok === cases.length ? 0 : 1);
}

// --- provider assembly (mirrors the worker) -----------------------------------
async function buildProviders() {
  const { createTwitterProvider } = require(path.join(ROOT, "packages/twitter/dist/index.js"));
  const { createLlmProvider } = require(path.join(ROOT, "packages/llm/dist/index.js"));
  const cachePkg = require(path.join(ROOT, "packages/cache/dist/index.js"));

  let store;
  let storeKindTw = "prisma";
  try {
    store = { tw: new cachePkg.PrismaCacheStore("twitter"), llm: new cachePkg.PrismaCacheStore("llm") };
  } catch {
    storeKindTw = "in-memory (DB unavailable)";
    store = { tw: new cachePkg.InMemoryCacheStore(), llm: new cachePkg.InMemoryCacheStore() };
  }
  const twitter = cachePkg.withTwitterCache(
    createTwitterProvider(),
    store.tw,
    cachePkg.resolveCacheConfig()
  );
  const llm = cachePkg.withLlmCache(
    createLlmProvider(),
    store.llm,
    cachePkg.resolveClassificationCacheConfig()
  );
  return { twitter, llm, cacheStore: storeKindTw };
}

// --- output helpers -------------------------------------------------------------
const METRICS = [
  "engaged_audience_match", "audience_quality", "content_fit", "campaign_goal_fit",
  "brand_safety", "geo_language_fit", "paid_promo_risk", "bot_farm_risk",
];
const pad = (s, n) => String(s).padEnd(n);

(async () => {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  if (args.includes("--selftest")) selftest();
  const live = args.includes("--live");
  const filter = args.find((a) => !a.startsWith("--"))?.toLowerCase();

  loadEnv();
  const twitterKind = (process.env.TWITTER_PROVIDER ?? "mock").trim();
  const llmKind = (process.env.LLM_PROVIDER ?? "mock").trim();
  const isLive = twitterKind !== "mock" || llmKind !== "mock";

  if (isLive && !live) {
    console.error(
      `Providers resolve to LIVE (twitter=${twitterKind}, llm=${llmKind}) — calibration runs are billable.\n` +
        "Re-run with `pnpm calibrate -- --live` to proceed, or set TWITTER_PROVIDER=mock LLM_PROVIDER=mock."
    );
    process.exit(2);
  }
  if (!isLive) {
    console.log("=".repeat(76));
    console.log("MOCK PROVIDERS — pipeline exercise only; results are NOT meaningful for");
    console.log("calibration. Set live providers in .env and pass --live for a real run.");
    console.log("=".repeat(76));
  }

  const { pairs } = JSON.parse(fs.readFileSync(PAIRS_PATH, "utf8"));
  const selected = pairs.filter(
    (p) => !filter || `${p.orgHandle} ${p.kolHandle}`.toLowerCase().includes(filter)
  );
  if (selected.length === 0) {
    console.error(filter ? `No pairs match "${filter}".` : "pairs.json has no pairs.");
    process.exit(2);
  }

  const { runAnalysis, resolveCaps } = require(path.join(ROOT, "packages/analysis/dist/index.js"));
  const { twitter, llm, cacheStore } = await buildProviders();
  const caps = resolveCaps();
  console.log(`providers: twitter=${twitterKind}, llm=${llmKind} (model ${llm.model}); cache=${cacheStore}\n`);

  const results = [];
  let misses = 0;
  for (const pair of selected) {
    const label = `${pair.orgHandle} × ${pair.kolHandle}`;
    process.stdout.write(`── ${label}  (expected ${pair.expected})\n`);
    const t0 = Date.now();
    try {
      const res = await runAnalysis(
        { orgHandle: pair.orgHandle.toLowerCase(), kolHandle: pair.kolHandle.toLowerCase() },
        { twitter, llm, caps }
      );
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      const verdict = res.report.verdict;
      const passStr = matchesExpected(pair.expected, verdict) ? "PASS" : "MISS";
      if (passStr === "MISS") misses++;
      console.log(
        `   ${passStr}  verdict=${verdict}  overall=${res.report.overallScore.value}  confidence=${res.report.confidence}  (${secs}s)`
      );
      for (const m of METRICS) {
        const v = res.scores.components[m];
        console.log(`     ${pad(m, 24)} ${v ? v.value : "—"}`);
      }
      const ev = res.evidence;
      console.log(
        `     ${pad("samples", 24)} posts=${ev.kolPostsSampled} engaged=${ev.engagedAccountsSampled} classified=${ev.audienceDistribution.sampleSize}`
      );
      results.push({
        pair: label, expected: pair.expected, verdict, pass: passStr === "PASS",
        overall: res.report.overallScore.value, confidence: res.report.confidence,
        components: Object.fromEntries(METRICS.map((m) => [m, res.scores.components[m]?.value ?? null])),
        seconds: Number(secs), notes: pair.notes ?? null,
      });
    } catch (err) {
      misses++;
      console.log(`   ERROR after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${err && err.message ? err.message : err}`);
      results.push({ pair: label, expected: pair.expected, error: String(err && err.message ? err.message : err), pass: false });
    }
    console.log("");
  }

  const passed = results.filter((r) => r.pass).length;
  console.log("=".repeat(76));
  console.log(`CALIBRATION: ${passed}/${selected.length} pairs in expected range${isLive ? "" : "  [MOCK — not meaningful]"}`);
  fs.writeFileSync(
    LAST_RUN_PATH,
    JSON.stringify(
      { at: new Date().toISOString(), providers: { twitter: twitterKind, llm: llmKind }, results },
      null,
      2
    )
  );
  console.log(`results written to scripts/calibration/last-run.json`);
  process.exit(misses > 0 ? 1 : 0);
})();
