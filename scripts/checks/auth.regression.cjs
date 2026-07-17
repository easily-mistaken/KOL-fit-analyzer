// Regression check for Unit 28 (User Authentication) — the pure @kol-fit/auth
// security core. Sign-in is Google-only via Supabase; this pins the auth-mode
// resolution that gates it. Offline, no DB, no keys, no network.
//
// Run after `pnpm build`:  node scripts/checks/auth.regression.cjs
// (or `pnpm check:auth`). Requires packages/auth/dist/index.js.

const { resolveAuthMode } = require("../../packages/auth/dist/index.js");

let pass = 0,
  fail = 0;
const ck = (n, c) => {
  console.log((c ? "OK   " : "FAIL ") + n);
  c ? pass++ : fail++;
};

// --- resolveAuthMode -------------------------------------------------------
// "supabase" (Google sign-in active) iff BOTH public Supabase vars are set;
// otherwise "dev" (sign-in unavailable, anonymous use only).

ck(
  "both supabase vars set -> supabase",
  resolveAuthMode({
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  }) === "supabase"
);
ck(
  "missing anon key -> dev",
  resolveAuthMode({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }) === "dev"
);
ck(
  "missing url -> dev",
  resolveAuthMode({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key" }) === "dev"
);
ck("neither var -> dev", resolveAuthMode({}) === "dev");
ck(
  "empty/whitespace vars -> dev",
  resolveAuthMode({
    NEXT_PUBLIC_SUPABASE_URL: "  ",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  }) === "dev"
);

console.log(`\nAUTH REGRESSION: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
