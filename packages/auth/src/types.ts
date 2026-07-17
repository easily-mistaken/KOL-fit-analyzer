// Framework-agnostic auth types (Unit 28). This package is the pure auth core —
// no Next, Prisma, Supabase, or zod; no runtime dependencies.

/** A resolved end user. `email` may be null when it is not yet known. */
export type AuthUser = { id: string; email: string | null };

/**
 * Which auth backend is active. "dev" means anonymous-only — no sign-in, history
 * scoped to the browser cookie; "supabase" activates (Google sign-in) when both
 * Supabase env vars are set.
 */
export type AuthMode = "dev" | "supabase";

/** The subset of environment values this package reads. */
export type AuthEnv = Record<string, string | undefined>;
