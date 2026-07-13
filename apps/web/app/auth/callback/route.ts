import { NextResponse } from "next/server";
import { resolveAuthMode } from "@kol-fit/auth";

// ============================================================================
// Supabase OAuth / magic-link callback (Unit 28) — SUPABASE MODE ONLY.
// ACTIVATE + VERIFY AT DEPLOY — NOT YET LIVE-VERIFIED. Unused on the dev path
// (dev logs in via POST /api/auth/session). Exchanges the code for a session,
// mirror-upserts the local User, claims the anonymous browser's reports, and
// redirects home. @supabase/ssr is reached only via dynamic import() so the dev
// runtime never loads it.
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

  const { exchangeSupabaseCode } = await import("@/lib/auth/supabase");
  const userId = await exchangeSupabaseCode(code);
  if (!userId) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Adopt the anonymous browser's history into the account. Best-effort.
  const { claimAnonymousReports } = await import("@/lib/auth/claim");
  await claimAnonymousReports(userId);

  return NextResponse.redirect(`${origin}/`);
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}
