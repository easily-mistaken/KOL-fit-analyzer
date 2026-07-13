// Framework-agnostic auth types (Unit 28). This package is the pure security
// core — no Next, Prisma, Supabase, or zod; only node:crypto.

/** A resolved end user. `email` may be null when it is not yet known. */
export type AuthUser = { id: string; email: string | null };

/**
 * Which auth backend is active. "dev" is the default passwordless email login
 * that runs fully on localhost; "supabase" activates when Supabase env is set.
 */
export type AuthMode = "dev" | "supabase";

/** The subset of environment values this package reads. */
export type AuthEnv = Record<string, string | undefined>;
