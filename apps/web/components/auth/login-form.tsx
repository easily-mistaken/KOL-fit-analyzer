"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import type { ApiResponse } from "@kol-fit/shared";
import type { AuthMode } from "@kol-fit/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SessionUser = { id: string; email: string };

/**
 * Login form (Unit 28). Branches on the server-provided auth mode:
 * - dev: an email field that posts to /api/auth/session (passwordless dev
 *   login); on success it routes to /analyses.
 * - supabase: a minimal magic-link/OAuth entry (kept minimal; the real flow is
 *   activated + verified at deploy — see the Supabase adapter).
 */
export function LoginForm({ mode }: { mode: AuthMode }) {
  if (mode === "supabase") return <SupabaseEntry />;
  return <DevEmailForm />;
}

function DevEmailForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim();
    if (!value || !value.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const body = (await res.json()) as ApiResponse<SessionUser>;
      if (body.ok) {
        router.push("/analyses");
        router.refresh();
        return;
      }
      setError(body.error.message);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-default bg-surface p-6 shadow-card"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <LogIn className="h-5 w-5 text-accent-hover" />
          <h1 className="text-[15px] font-semibold text-foreground">Sign in</h1>
        </div>
        <p className="text-sm text-secondary-foreground">
          Enter your email to sign in. Your saved reports follow your account
          across devices.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          autoFocus
          disabled={loading}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading || !email}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          "Continue"
        )}
      </Button>
    </form>
  );
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
 * Supabase-mode sign-in: "Continue with Google". `signInWithOAuth` redirects the
 * browser to Google → Supabase → our /auth/callback (PKCE code exchange). The
 * @supabase/ssr browser client is dynamic-imported so it never lands in the dev
 * bundle (dev mode renders DevEmailForm and never this component).
 */
function SupabaseEntry() {
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
          <LogIn className="h-5 w-5 text-accent-hover" />
          <h1 className="text-[15px] font-semibold text-foreground">Sign in</h1>
        </div>
        <p className="text-sm text-secondary-foreground">
          Signing in is optional. You can run analyses without an account. Sign
          in to keep your saved reports across devices.
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
