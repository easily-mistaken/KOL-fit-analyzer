import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ============================================================================
// Repo-root .env loading (build-time correctness for NEXT_PUBLIC_*).
//
// The monorepo keeps one .env at the repo root. Next only reads .env from its
// own project directory (apps/web), which locally works via a gitignored
// apps/web/.env -> ../../.env symlink. That symlink is not in git, so on a
// fresh checkout (the production VPS) `next build` sees no .env at all: every
// NEXT_PUBLIC_* is inlined into the client bundle as `undefined`, while the
// server keeps reading real values from the process environment. That split is
// invisible — the server renders the signed-out UI correctly and only the
// browser half is broken.
//
// Loading the root .env here, before Next resolves this config, makes the build
// independent of that symlink. Real process env always wins, so systemd's
// EnvironmentFile and one-off shell overrides keep their precedence.
// ============================================================================

const rootEnvPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.env"
);

/** Strip one layer of matching surrounding quotes, if present. */
function unquote(value) {
  const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
  return quoted ? quoted[2] : value;
}

/**
 * Minimal KEY=VALUE reader — deliberately not a full dotenv: it does not strip
 * trailing `#` comments (secrets legitimately contain `#`) and skips anything
 * that isn't a plain assignment, including full-line comments.
 */
function loadRootEnv() {
  let raw;
  try {
    raw = readFileSync(rootEnvPath, "utf8");
  } catch {
    return; // No root .env (CI, or env injected directly) — nothing to do.
  }
  for (const line of raw.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key] !== undefined) continue; // real env wins
    process.env[key] = unquote(value.trim());
  }
}

loadRootEnv();

// The client bundle's auth mode is frozen at build time, so a missing
// NEXT_PUBLIC_SUPABASE_* pair silently ships an anonymous-only site. Say so in
// the build log rather than letting a user discover it on click.
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
) {
  console.warn(
    "[next.config] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY " +
      "are not set at build time — this build ships with Google sign-in disabled."
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
