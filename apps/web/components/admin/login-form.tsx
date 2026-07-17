"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Admin login (Unit 27). Posts the shared password to the session route; the
 * server sets an httpOnly cookie. Failures are deliberately generic — the form
 * never reveals whether the panel is configured or why a password was rejected.
 */
export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/admin");
        router.refresh();
        return;
      }
      setError("Incorrect password.");
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
          <Lock className="h-5 w-5 text-accent-ink" />
          <h1 className="text-[15px] font-semibold text-foreground">Admin</h1>
        </div>
        <p className="text-sm text-secondary-foreground">
          Enter the admin password to continue.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="admin-password">Password</Label>
        <Input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          disabled={loading}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading || !password}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
