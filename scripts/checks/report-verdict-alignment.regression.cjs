// Unit 53 regression: report narrative must agree with the deterministic
// verdict. The failure this guards: the report-narrative prompt asked the model
// to "reference the verdict qualitatively" but NEVER included the verdict, the
// overall score, or the computed reasons (risk gates, activity/originality
// discounts). The model re-derived fit from the raw audience distributions and
// wrote "the creator is a solid match" prose on an AVOID report. The fix feeds
// the deterministic result into the prompt with a hard alignment instruction.
//
// Run after `pnpm build`:  node scripts/checks/report-verdict-alignment.regression.cjs
// (or `pnpm check:report-verdict-alignment`). Pure — no network, no keys, no DB.

const { buildReportPrompt } = require("../../packages/llm/dist/openai/prompts.js");
const { SCORING_VERSION } = require("../../packages/shared/dist/constants.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

// --- fixture: an AVOID pair where the raw distributions LOOK great -----------
// This is the @thalerfinance-vs-@priyansh_ptl18 shape: developer/founder-heavy
// real audience (reads as a match), but the verdict is AVOID via the overall
// score / gates. The prompt must carry the verdict so the model cannot conclude
// the opposite from the appealing distributions alone.

const sv = (value, reasons = []) => ({ value, confidence: "medium", reasons });

const input = {
  org: {
    handle: "thalerfinance",
    classification: {
      productCategory: "crypto infrastructure",
      targetUser: "developers and technical founders",
      keywords: ["infra"],
      confidence: "high",
      targetRoles: { primary: ["developer"], secondary: ["founder"] },
      targetDomains: { primary: ["crypto_infra"], secondary: ["software"] },
    },
  },
  kol: {
    handle: "priyansh_ptl18",
    content: {
      themes: ["dev logs"], verticals: ["software"], style: "casual", depth: "medium",
      promoPatterns: [], repeatedTickers: [], postLabels: [], brandSafetyFlags: [], mediaLabels: [],
    },
  },
  audience: {
    accounts: [],
    distribution: {
      sampleSize: 100,
      roles: { developer: { count: 55, share: 0.55 }, founder: { count: 20, share: 0.2 } },
      domains: { crypto_infra: { count: 40, share: 0.4 }, software: { count: 35, share: 0.35 } },
      quality: { real: { count: 60, share: 0.6 }, bot: { count: 40, share: 0.4 } },
    },
  },
  scores: {
    overall: sv(24, [
      "Fit 24/100 = engaged-audience match 40/100 x activity 0.80 x originality 0.75 → AVOID.",
      "Verdict capped by a risk gate: paid-promo risk 20 (unrelated share 0%), bot/farm risk 78, brand safety 90.",
    ]),
    components: {
      engaged_audience_match: sv(40, ["Role match is real but diluted by junk engagement."]),
      audience_quality: sv(30, ["40% of classified engagers are bots."]),
      bot_farm_risk: sv(78, ["Bot-heavy reply cohort."]),
      paid_promo_risk: sv(20),
    },
    confidence: "high",
  },
  verdict: "AVOID",
  sampleSizes: { engagedAccounts: 100 },
};

const prompt = buildReportPrompt(input);

// --- 1. the deterministic result is actually IN the prompt -------------------
ck("prompt states the verdict", /verdict=AVOID/.test(prompt));
ck("prompt glosses AVOID as recommend-against", /recommend AGAINST/i.test(prompt));
ck("prompt carries the overall value and confidence", /overall fit 24\/100/.test(prompt) && /confidence=high/.test(prompt));
ck("prompt carries the computed reasons (incl. the risk-gate line)", /Verdict capped by a risk gate/.test(prompt));
ck("prompt carries component scores", /engaged_audience_match=40\/100/.test(prompt) && /bot_farm_risk=78\/100/.test(prompt));
ck("prompt explains risk-metric polarity", /HIGHER = MORE risk/i.test(prompt));

// --- 2. the alignment instruction is load-bearing ----------------------------
ck("prompt demands narrative agreement with the verdict", /must AGREE with this verdict/i.test(prompt));
ck("prompt directs the summary to open with the verdict-consistent conclusion", /Open `summary` with the verdict-consistent/i.test(prompt));
ck("prompt frames contrary positives as weighed context, never a contradiction", /NEVER as a conclusion that contradicts the verdict/i.test(prompt));
ck("prompt aligns keyTakeaways too", /keyTakeaways entry/.test(prompt));
ck("prompt keeps the no-numbers-in-output rule", /do NOT state or invent any numeric scores/i.test(prompt) || /NOT state or invent any numeric scores/.test(prompt));
ck("prompt still marks scores/verdict as final and not the model's to alter", /Do NOT output, repeat, recompute, or alter/i.test(prompt));

// --- 3. degrades gracefully when scores/verdict are absent -------------------
const bare = buildReportPrompt({ ...input, scores: undefined, verdict: undefined });
ck("without scores the deterministic block is omitted (no fabricated result)", !/DETERMINISTIC RESULT/.test(bare) && !/verdict=/.test(bare));

// --- 4. stale contradictory reports cannot be reused -------------------------
ck(`SCORING_VERSION bumped to 8 so pre-fix reports are not served on re-submit (got ${SCORING_VERSION})`, SCORING_VERSION === 8);

console.log(`\nREPORT-VERDICT ALIGNMENT REGRESSION (Unit 53): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
