import { err, ok, type ApiResponse } from "@kol-fit/shared";
import { resolveAuthMode, devLoginAllowed } from "@kol-fit/auth";
import { prisma } from "@kol-fit/db";

import { setDevSession, clearDevSession } from "@/lib/auth/session";
import { claimAnonymousReports } from "@/lib/auth/claim";

// Dev email login sets/clears the HMAC session cookie with node:crypto; must
// never be cached or prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionUser = { id: string; email: string };

function json(body: ApiResponse<SessionUser | { ok: true }>, status: number): Response {
  return Response.json(body, { status });
}

/**
 * POST /api/auth/session — dev email login (Unit 28).
 *
 * Only active in dev mode and when passwordless dev login is allowed (fail-closed
 * in production). Validates a minimal email, upserts the `User`, sets the dev
 * session cookie, then claims the current anonymous browser's reports. Supabase
 * mode logs in through /auth/callback instead, so this 404s there.
 */
export async function POST(req: Request): Promise<Response> {
  // Guard: no passwordless login in Supabase mode or when disabled in prod.
  if (resolveAuthMode(process.env) !== "dev" || !devLoginAllowed(process.env)) {
    return json(err("not_found", "Not found."), 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(err("validation_error", "Invalid JSON body"), 400);
  }

  const raw =
    typeof body === "object" && body !== null && "email" in body
      ? (body as { email: unknown }).email
      : undefined;
  if (typeof raw !== "string") {
    return json(err("validation_error", "email: expected a string"), 400);
  }
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || !email.includes("@")) {
    return json(err("validation_error", "email: enter a valid email address"), 400);
  }

  try {
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, lastLoginAt: new Date() },
      update: { lastLoginAt: new Date() },
    });

    await setDevSession(user.id);
    // Adopt the anonymous browser's history into the account. Best-effort.
    await claimAnonymousReports(user.id);

    return json(ok({ id: user.id, email: user.email }), 200);
  } catch (error) {
    // Never leak DB/driver errors or the compared values.
    console.error("[POST /api/auth/session] login failed:", error);
    return json(err("internal_error", "Failed to sign in."), 500);
  }
}

/**
 * DELETE /api/auth/session — sign out. Clears the dev session cookie and, in
 * Supabase mode, signs out of Supabase too. Safe to call without a session.
 */
export async function DELETE(): Promise<Response> {
  try {
    await clearDevSession();
    if (resolveAuthMode(process.env) === "supabase") {
      const { supabaseSignOut } = await import("@/lib/auth/supabase");
      await supabaseSignOut();
    }
    return json(ok({ ok: true }), 200);
  } catch (error) {
    console.error("[DELETE /api/auth/session] sign out failed:", error);
    return json(err("internal_error", "Failed to sign out."), 500);
  }
}
