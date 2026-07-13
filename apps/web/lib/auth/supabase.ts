import { cookies } from "next/headers";
import { prisma } from "@kol-fit/db";
import type { AuthUser } from "@kol-fit/auth";

// ============================================================================
// Supabase auth adapter (Unit 28) — SUPABASE MODE ONLY.
//
// ACTIVATE + VERIFY AT DEPLOY — NOT YET LIVE-VERIFIED. This adapter cannot be
// run locally (there is no Supabase project on the dev path). It is built to the
// current official @supabase/ssr App-Router guide
// (https://supabase.com/docs/guides/auth/server-side/nextjs — server client +
// getClaims), typechecked, and kept fully isolated behind resolveAuthMode():
// nothing here executes in dev mode, and @supabase/ssr is imported dynamically
// so the dev runtime never loads it. The server-side user is read via
// getClaims() (JWT-verified) — NEVER getSession().
// ============================================================================

/**
 * Creates a request-scoped Supabase server client wired to Next cookies, per the
 * official @supabase/ssr guide. `setAll` is wrapped in try/catch because Server
 * Components cannot write cookies (the middleware refreshes sessions instead).
 */
export async function createServerSupabase() {
  const { createServerClient } = await import("@supabase/ssr");
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore; the middleware
            // refreshes the session on every request.
          }
        },
      },
    }
  );
}

type SupabaseClaims = { sub?: unknown; email?: unknown } | null | undefined;

/** Extracts the JWT-verified claims (getClaims, never getSession). */
async function readClaims(): Promise<SupabaseClaims> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  return data?.claims as SupabaseClaims;
}

/** The signed-in Supabase user id (claims.sub), or null. */
export async function getSupabaseUserId(): Promise<string | null> {
  const claims = await readClaims();
  const sub = claims?.sub;
  return typeof sub === "string" && sub.length > 0 ? sub : null;
}

/**
 * Resolves the current Supabase user (id + email) and mirror-upserts a local
 * `User` row (id = the Supabase UUID) so ownership/claims map onto a real row.
 */
export async function getSupabaseUser(): Promise<AuthUser | null> {
  const claims = await readClaims();
  const sub = typeof claims?.sub === "string" ? claims.sub : null;
  if (!sub) return null;
  const email = typeof claims?.email === "string" ? claims.email : null;
  await mirrorUser(sub, email);
  return { id: sub, email };
}

/** Upserts the local mirror row for a Supabase user. Best-effort. */
export async function mirrorUser(
  id: string,
  email: string | null
): Promise<void> {
  try {
    if (email) {
      await prisma.user.upsert({
        where: { id },
        create: { id, email, lastLoginAt: new Date() },
        update: { email, lastLoginAt: new Date() },
      });
    } else {
      // No email in the claims — keep the row present without clobbering email.
      await prisma.user.upsert({
        where: { id },
        create: { id, email: `${id}@supabase.local`, lastLoginAt: new Date() },
        update: { lastLoginAt: new Date() },
      });
    }
  } catch {
    console.error("[auth] supabase user mirror-upsert failed (non-fatal)");
  }
}

/**
 * Exchanges an OAuth/magic-link code for a session (the /auth/callback flow).
 * Returns the resolved user id on success, or null.
 */
export async function exchangeSupabaseCode(code: string): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return null;
  return getSupabaseUserId();
}

/** Signs the Supabase user out (clears its auth cookies). Best-effort. */
export async function supabaseSignOut(): Promise<void> {
  try {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  } catch {
    // Ignore — sign-out is best-effort.
  }
}
