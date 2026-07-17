import { NextResponse, type NextRequest } from "next/server";

// ============================================================================
// Auth middleware (Unit 28).
//
// DEV MODE (default): a strict no-op — localhost is unaffected.
//
// SUPABASE MODE: refreshes the Supabase session per the current official
// @supabase/ssr middleware pattern (getClaims + request/response cookie
// passthrough).
//
// The Supabase-mode branch dynamic-imports @supabase/ssr so it never loads on
// the dev path. The mode check is inlined (rather than importing
// @kol-fit/auth's resolveAuthMode) to keep node:crypto out of the Edge runtime
// bundle — it mirrors resolveAuthMode exactly: supabase iff BOTH env vars are
// non-empty.
// ============================================================================

function isSupabaseMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && url.trim() && key && key.trim());
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (!isSupabaseMode()) {
    // Dev mode: do nothing.
    return NextResponse.next();
  }

  const { createServerClient } = await import("@supabase/ssr");

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: read the user with getClaims() (JWT-verified) — never
  // getSession() — and do nothing between createServerClient and getClaims().
  await supabase.auth.getClaims();

  // Session refresh only — the app is not hard-gated, so we never redirect.
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image files:
     * - _next/static, _next/image, favicon.ico, common image extensions.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
