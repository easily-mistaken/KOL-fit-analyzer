// Regression check for Unit 28 (User Authentication) — the pure @kol-fit/auth
// security core: the signed dev-session token and the auth-mode / dev-login
// gates. Offline, no DB, no keys, no network.
//
// Run after `pnpm build`:  node scripts/checks/auth.regression.cjs
// (or `pnpm check:auth`). Requires packages/auth/dist/index.js.

const {
  signSessionToken,
  verifySessionToken,
  resolveAuthMode,
  devLoginAllowed,
} = require("../../packages/auth/dist/index.js");

let pass = 0,
  fail = 0;
const ck = (n, c) => {
  console.log((c ? "OK   " : "FAIL ") + n);
  c ? pass++ : fail++;
};

const SECRET = "unit-28-test-secret-please-do-not-reuse";
const USER = "clkol0000userid0000abcd";

// --- signSessionToken / verifySessionToken round-trip ----------------------

const token = signSessionToken(USER, SECRET);
ck(`token has exactly one dot`, token.split(".").length === 2);
ck(`token starts with "${USER}."`, token.startsWith(USER + "."));
ck(
  `round-trips to the same userId`,
  verifySessionToken(token, SECRET) === USER
);

// --- tamper / wrong secret / malformed -> null (never throws) --------------

// Wrong secret.
ck("wrong secret -> null", verifySessionToken(token, "different-secret") === null);

// Tampered userId segment (signature no longer matches).
const [, sig] = token.split(".");
ck(
  "tampered userId -> null",
  verifySessionToken(`${USER}x.${sig}`, SECRET) === null
);

// Tampered signature segment (flip the last char).
const flipped = sig.slice(0, -1) + (sig.slice(-1) === "A" ? "B" : "A");
ck(
  "tampered signature -> null",
  verifySessionToken(`${USER}.${flipped}`, SECRET) === null
);

// Constant-time path: a signature of the SAME length but wrong content -> null.
const sameLenWrong = "Z".repeat(sig.length);
ck(
  "valid-length wrong signature -> null (constant-time path)",
  verifySessionToken(`${USER}.${sameLenWrong}`, SECRET) === null
);

// Malformed shapes.
ck("no dot -> null", verifySessionToken("nodothere", SECRET) === null);
ck("empty string -> null", verifySessionToken("", SECRET) === null);
ck(
  "extra segments -> null",
  verifySessionToken(`${USER}.${sig}.extra`, SECRET) === null
);
ck("empty userId segment -> null", verifySessionToken(`.${sig}`, SECRET) === null);
ck("empty signature segment -> null", verifySessionToken(`${USER}.`, SECRET) === null);
ck("empty secret -> null", verifySessionToken(token, "") === null);

// Never throws on odd inputs.
let threw = false;
try {
  verifySessionToken(token, SECRET);
  verifySessionToken("a.b.c.d", SECRET);
  verifySessionToken("....", SECRET);
} catch {
  threw = true;
}
ck("verify never throws on odd inputs", threw === false);

// --- resolveAuthMode -------------------------------------------------------

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

// --- devLoginAllowed -------------------------------------------------------

ck(
  "prod + no flag -> false (fail-closed)",
  devLoginAllowed({ NODE_ENV: "production" }) === false
);
ck(
  "prod + AUTH_DEV_LOGIN=true -> true",
  devLoginAllowed({ NODE_ENV: "production", AUTH_DEV_LOGIN: "true" }) === true
);
ck("non-prod -> true", devLoginAllowed({ NODE_ENV: "development" }) === true);
ck("no NODE_ENV -> true", devLoginAllowed({}) === true);
ck(
  "prod + AUTH_DEV_LOGIN=1 (not 'true') -> false",
  devLoginAllowed({ NODE_ENV: "production", AUTH_DEV_LOGIN: "1" }) === false
);

console.log(`\nAUTH REGRESSION: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
