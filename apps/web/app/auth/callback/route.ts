import { NextResponse } from "next/server";
import { resolveAuthMode } from "@kol-fit/auth";

// ============================================================================
// Supabase OAuth callback (Unit 28) — SUPABASE MODE ONLY. This is the sole
// sign-in path (Google via Supabase); dev mode has no login and redirects to
// /login. Exchanges the code for a session, mirror-upserts the local User,
// claims the anonymous browser's reports, and redirects to History.
// @supabase/ssr is reached only via dynamic import() so dev never loads it.
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request): Promise<Response> {
  const { origin } = new URL(req.url);

  // Dev mode has no Supabase callback — send back to login.
  if (resolveAuthMode(process.env) !== "supabase") {
    return NextResponse.redirect(`${origin}/login`);
  }

  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const { exchangeSupabaseCode, mirrorUser } = await import("@/lib/auth/supabase");
  const user = await exchangeSupabaseCode(code);
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Maintain the local User mirror row once, here at login (the per-request
  // reads are pure). Then adopt the anonymous browser's history into the
  // account. Both best-effort — neither blocks landing the user.
  await mirrorUser(user.id, user.email);
  const { claimAnonymousReports } = await import("@/lib/auth/claim");
  await claimAnonymousReports(user.id);

  // Land on History so the just-claimed reports are the first thing they see.
  return NextResponse.redirect(`${origin}/analyses`);
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}
