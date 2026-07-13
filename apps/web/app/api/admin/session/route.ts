import { err, ok, type ApiResponse } from "@kol-fit/shared";

import {
  clearAdminSession,
  isAdminConfigured,
  setAdminSession,
  verifyAdminPassword,
} from "@/lib/admin/auth";

// The admin session cookie is set/cleared with node:crypto + next/headers.
export const runtime = "nodejs";
// Auth state must never be cached or prerendered.
export const dynamic = "force-dynamic";

type AdminSessionResult = { ok: true };

function json(body: ApiResponse<AdminSessionResult>, status: number): Response {
  return Response.json(body, { status });
}

/**
 * POST /api/admin/session
 *
 * Admin login (Unit 27). Exchanges the shared ADMIN_PASSWORD for the session
 * cookie. Fail-closed: with no password configured the panel does not exist, so
 * this 404s rather than advertising a disabled admin surface. The password is
 * compared in constant time (lib/admin/auth.ts) and is never logged or echoed.
 */
export async function POST(req: Request): Promise<Response> {
  if (!isAdminConfigured()) {
    return json(err("not_found", "Not found."), 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(err("validation_error", "Invalid JSON body"), 400);
  }

  // Hand-validated rather than with Zod: zod is not a direct dependency of
  // apps/web, and this is a single string field.
  const password =
    typeof body === "object" && body !== null && "password" in body
      ? (body as { password: unknown }).password
      : undefined;
  if (typeof password !== "string") {
    return json(err("validation_error", "password: expected a string"), 400);
  }

  try {
    if (!verifyAdminPassword(password)) {
      return json(err("unauthorized", "Incorrect password."), 401);
    }

    await setAdminSession();
    return json(ok({ ok: true }), 200);
  } catch (error) {
    // Never leak the error (it could carry the compared values) to the client.
    console.error("[POST /api/admin/session] failed to start session:", error);
    return json(err("internal_error", "Failed to sign in."), 500);
  }
}

/**
 * DELETE /api/admin/session
 *
 * Admin logout. Clears the cookie; safe to call without a valid session.
 */
export async function DELETE(): Promise<Response> {
  try {
    await clearAdminSession();
    return json(ok({ ok: true }), 200);
  } catch (error) {
    console.error("[DELETE /api/admin/session] failed to clear session:", error);
    return json(err("internal_error", "Failed to sign out."), 500);
  }
}
