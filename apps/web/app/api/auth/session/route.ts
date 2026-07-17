import { err, ok, type ApiResponse } from "@kol-fit/shared";
import { resolveAuthMode } from "@kol-fit/auth";

import { clearDevSession } from "@/lib/auth/session";

// Sign-out clears cookies with node:crypto-adjacent helpers and (in Supabase
// mode) hits Supabase; must never be cached or prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: ApiResponse<{ ok: true }>, status: number): Response {
  return Response.json(body, { status });
}

/**
 * DELETE /api/auth/session — sign out. Clears any legacy dev-session cookie and,
 * in Supabase mode, signs out of Supabase too. Safe to call without a session.
 * (Sign-in is Google-only via /auth/callback; there is no POST login here.)
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
