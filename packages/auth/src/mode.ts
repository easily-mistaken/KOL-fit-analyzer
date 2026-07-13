import type { AuthEnv, AuthMode } from "./types.js";

// Auth-mode resolution (Unit 28). The seam flips from the dev email login to
// real Supabase Auth purely on the presence of Supabase env — no app code
// change at deploy.

/** Non-empty string helper (trims). */
function present(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * "supabase" iff BOTH NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * are non-empty; otherwise "dev".
 */
export function resolveAuthMode(env: AuthEnv): AuthMode {
  return present(env.NEXT_PUBLIC_SUPABASE_URL) &&
    present(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    ? "supabase"
    : "dev";
}

/**
 * Whether passwordless dev login is permitted. Fail-closed: disabled in
 * production unless AUTH_DEV_LOGIN === "true" is explicitly set. Always allowed
 * outside production.
 */
export function devLoginAllowed(env: AuthEnv): boolean {
  if (env.NODE_ENV === "production" && env.AUTH_DEV_LOGIN !== "true") {
    return false;
  }
  return true;
}
