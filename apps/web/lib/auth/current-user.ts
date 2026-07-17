import { unstable_rethrow } from "next/navigation";
import { resolveAuthMode, type AuthUser } from "@kol-fit/auth";

// The auth seam the rest of the app reads (Unit 28). owner.ts and the nav call
// these; the Supabase adapter below the seam is loaded via dynamic import() so
// the runtime never pulls in @supabase/ssr until Supabase mode is active. Sign-in
// is Google-only; when Supabase isn't configured, there is no signed-in user
// (anonymous use still works).

/**
 * The current signed-in user id, or null when anonymous / not configured. This
 * is the Supabase user id.
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (resolveAuthMode(process.env) !== "supabase") return null;
  const { getSupabaseUserId } = await import("./supabase");
  return getSupabaseUserId();
}

/**
 * The current user's id + email, or null. Used by the nav only. Reads Supabase
 * claims and mirror-upserts the local `User` row. Never throws — a DB hiccup
 * degrades to "logged out" for the nav.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    if (resolveAuthMode(process.env) !== "supabase") return null;
    const { getSupabaseUser } = await import("./supabase");
    return await getSupabaseUser();
  } catch (error) {
    // Never swallow Next control-flow signals (dynamic-rendering bailout from
    // cookies(), redirect, notFound) — doing so would let the nav be prerendered
    // with a stale, always-logged-out state. Only real errors (e.g. a DB hiccup)
    // degrade to "logged out" for the nav.
    unstable_rethrow(error);
    console.error("[auth] getCurrentUser failed (treating as logged out)");
    return null;
  }
}
