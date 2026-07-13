import { unstable_rethrow } from "next/navigation";
import { resolveAuthMode, type AuthUser } from "@kol-fit/auth";
import { prisma } from "@kol-fit/db";

import { readDevUserId } from "./session";

// The auth seam the rest of the app reads (Unit 28). owner.ts and the nav call
// these; everything below the seam (dev session vs Supabase) is hidden here. The
// Supabase branch is loaded via dynamic import() so the dev runtime never pulls
// in @supabase/ssr.

/**
 * The current signed-in user id, or null when anonymous. In Supabase mode this
 * is the Supabase user id; in dev mode it is the dev-session user id.
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (resolveAuthMode(process.env) === "supabase") {
    const { getSupabaseUserId } = await import("./supabase");
    return getSupabaseUserId();
  }
  return readDevUserId();
}

/**
 * The current user's id + email, or null. Used by the nav only. Dev mode loads
 * the `User` row by id; Supabase mode reads claims and mirror-upserts. Never
 * throws — a DB hiccup degrades to "logged out" for the nav.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    if (resolveAuthMode(process.env) === "supabase") {
      const { getSupabaseUser } = await import("./supabase");
      return await getSupabaseUser();
    }

    const id = await readDevUserId();
    if (!id) return null;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return { id: user.id, email: user.email };
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
