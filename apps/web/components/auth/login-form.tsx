"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, Mail } from "lucide-react";
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

function SupabaseEntry() {
  return (
    <div className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-default bg-surface p-6 shadow-card">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-accent-hover" />
          <h1 className="text-[15px] font-semibold text-foreground">Sign in</h1>
        </div>
        <p className="text-sm text-secondary-foreground">
          This deployment uses Supabase Auth. Continue with the magic-link / OAuth
          flow to sign in; your saved reports follow your account across devices.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        The Supabase sign-in flow is activated and verified at deploy.
      </p>
    </div>
  );
}
