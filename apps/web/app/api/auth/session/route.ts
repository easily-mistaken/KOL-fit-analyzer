import { err, ok, type ApiResponse } from "@kol-fit/shared";
import { resolveAuthMode } from "@kol-fit/auth";

// Sign-out hits Supabase (Supabase mode) to clear its auth cookies; must never
// be cached or prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: ApiResponse<{ ok: true }>, status: number): Response {
  return Response.json(body, { status });
}

/**
 * DELETE /api/auth/session — sign out. In Supabase mode this signs out of
 * Supabase (clearing its auth cookies). Safe to call without a session.
 * (Sign-in is Google-only via /auth/callback; there is no POST login here.)
 */
export async function DELETE(): Promise<Response> {
  try {
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
