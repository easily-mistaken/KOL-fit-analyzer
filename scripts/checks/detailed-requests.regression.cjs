// Unit 35 regression: detailed-report request input normalization. Verifies
// telegram/x handle normalization (@ strips, t.me / x.com / twitter.com URL
// extraction), shape validation, optional pair handles (normalized), and the
// note cap.
//
// Run after `pnpm build`:  node scripts/checks/detailed-requests.regression.cjs
// (or `pnpm check:detailed-requests`). Offline — no network, no keys, no DB.

const {
  DetailedReportRequestInputSchema,
  normalizeTelegram,
  normalizeXHandle,
} = require("../../packages/shared/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

// --- normalizers -----------------------------------------------------------------
ck("telegram: @ stripped", normalizeTelegram("@crypto_pj") === "crypto_pj");
ck("telegram: t.me URL", normalizeTelegram("https://t.me/crypto_pj") === "crypto_pj");
ck("telegram: t.me short + trailing path", normalizeTelegram("t.me/crypto_pj?start=x") === "crypto_pj");
ck("x: @ stripped", normalizeXHandle("@haydenzadams") === "haydenzadams");
ck("x: x.com URL", normalizeXHandle("https://x.com/haydenzadams") === "haydenzadams");
ck("x: twitter.com URL with query", normalizeXHandle("https://twitter.com/haydenzadams?s=21") === "haydenzadams");
ck("x: mobile URL", normalizeXHandle("mobile.twitter.com/haydenzadams") === "haydenzadams");

// --- schema ----------------------------------------------------------------------
const base = { telegram: "@crypto_pj", xHandle: "x.com/someone" };
const good = DetailedReportRequestInputSchema.safeParse(base);
ck("minimal valid input parses + normalizes", good.success && good.data.telegram === "crypto_pj" && good.data.xHandle === "someone");

const full = DetailedReportRequestInputSchema.safeParse({
  ...base,
  orgHandle: "@Uniswap",
  kolHandle: "https err", // invalid on purpose? no — use valid below
});
ck("invalid kol handle rejected", full.success === false);

const withPair = DetailedReportRequestInputSchema.safeParse({
  ...base,
  orgHandle: "@Uniswap",
  kolHandle: "@haydenzadams",
  analysisRequestId: "cmrltnjle0004fck7zi5ocsa1",
  note: "focus on developer adoption",
});
ck("pair handles normalized like analysis handles", withPair.success && withPair.data.orgHandle === "uniswap" && withPair.data.kolHandle === "haydenzadams");

ck("bad telegram rejected", DetailedReportRequestInputSchema.safeParse({ telegram: "a b c!", xHandle: "ok_handle" }).success === false);
ck("bad x handle rejected", DetailedReportRequestInputSchema.safeParse({ telegram: "good_tg", xHandle: "way-too-long-for-an-x-handle-here" }).success === false);
ck("note over 500 chars rejected", DetailedReportRequestInputSchema.safeParse({ ...base, note: "x".repeat(501) }).success === false);
ck("empty inputs rejected", DetailedReportRequestInputSchema.safeParse({ telegram: "", xHandle: "" }).success === false);

// --- email (Unit 36.1: required for anonymous requesters, enforced server-side) --
const withEmail = DetailedReportRequestInputSchema.safeParse({ ...base, email: "  PJ@Example.COM " });
ck("email normalized to lowercase", withEmail.success && withEmail.data.email === "pj@example.com");
ck("invalid email rejected", DetailedReportRequestInputSchema.safeParse({ ...base, email: "not-an-email" }).success === false);
ck("email optional at schema level (auth enforced in the route)", DetailedReportRequestInputSchema.safeParse(base).success === true);

console.log(`\nDETAILED REQUESTS REGRESSION (35): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
