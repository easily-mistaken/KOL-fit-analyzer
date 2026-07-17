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
