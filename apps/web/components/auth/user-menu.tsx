"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import type { AuthUser } from "@kol-fit/auth";

import { cn } from "@/lib/utils";

/**
 * User menu (Unit 28). Shows the signed-in email + a "Sign out" action, or a
 * "Sign in" link to /login when logged out. The current user is resolved on the
 * server (nav only) and passed in, so this stays a thin client control. Sign out
 * DELETEs the session then refreshes so the server re-renders as anonymous.
 */
export function UserMenu({ user }: { user: AuthUser | null }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      router.refresh();
    } catch {
      // Non-fatal — a refresh will re-check the session either way.
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-secondary-foreground transition-colors hover:bg-elevated/60 hover:text-foreground sm:px-3"
      >
        <LogIn className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only">Sign in</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className="hidden max-w-[12rem] truncate text-sm text-secondary-foreground sm:inline"
        title={user.email ?? undefined}
      >
        {user.email ?? "Signed in"}
      </span>
      <button
        type="button"
        onClick={signOut}
        disabled={loading}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors sm:px-3",
          "text-secondary-foreground hover:bg-elevated/60 hover:text-foreground",
          loading && "opacity-60"
        )}
      >
        <LogOut className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only">Sign out</span>
      </button>
    </div>
  );
}
