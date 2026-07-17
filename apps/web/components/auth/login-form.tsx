"use client";

import * as React from "react";
import { Loader2, LogIn } from "lucide-react";
import type { AuthMode } from "@kol-fit/auth";

import { Button } from "@/components/ui/button";

/**
 * Login (Unit 28, Google-only). Sign-in is exclusively Google OAuth via
 * Supabase. When Supabase isn't configured in this environment the button would
 * have nothing to talk to, so we show a clear notice instead of a broken flow.
 * Anonymous use never requires signing in.
 */
export function LoginForm({ mode }: { mode: AuthMode }) {
  if (mode === "supabase") return <GoogleSignIn />;
  return <NotConfigured />;
}

// Google "G" mark (inline SVG — self-contained, no external asset / CSP issue).
function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.41 5.41 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

/**
 * "Continue with Google". `signInWithOAuth` redirects the browser to Google →
 * Supabase → our /auth/callback (PKCE code exchange, which then claims the
 * anonymous history and lands on the reports list). The @supabase/ssr browser
 * client is dynamic-imported so it never lands in the bundle until needed.
 */
function GoogleSignIn() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    try {
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      // On success the browser redirects to Google; nothing below runs.
      if (oauthError) {
        setError("Couldn't start Google sign-in. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Couldn't start Google sign-in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-default bg-surface p-6 shadow-card">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <LogIn className="h-5 w-5 text-accent-ink" />
          <h1 className="text-[15px] font-semibold text-foreground">Sign in</h1>
        </div>
        <p className="text-sm text-secondary-foreground">
          Sign in with Google to keep your reports across devices. You can also
          run analyses without an account.
        </p>
      </div>

      {error && (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={signInWithGoogle}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting…
          </>
        ) : (
          <>
            <GoogleMark />
            Continue with Google
          </>
        )}
      </Button>
    </div>
  );
}

/** Shown when Supabase (and therefore Google sign-in) isn't configured here. */
function NotConfigured() {
  return (
    <div className="mx-auto w-full max-w-sm space-y-2 rounded-2xl border border-default bg-surface p-6 shadow-card">
      <div className="flex items-center gap-2">
        <LogIn className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-[15px] font-semibold text-foreground">Sign in</h1>
      </div>
      <p className="text-sm text-secondary-foreground">
        Google sign-in isn&apos;t configured in this environment. You can still
        run analyses without an account.
      </p>
    </div>
  );
}
