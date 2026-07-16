"use client";

import * as React from "react";
import { Check, Link2, Loader2, X } from "lucide-react";

import type { ApiResponse } from "@kol-fit/shared";

import { Button } from "@/components/ui/button";

// Share-link control (Unit 38). Creates (or reuses) the report's public
// share token, copies the URL, and offers revoke while a link exists.

export function ShareReport({ requestId }: { requestId: string }) {
  const [state, setState] = React.useState<"idle" | "busy" | "copied" | "error">("idle");
  const [shared, setShared] = React.useState(false);

  async function share() {
    setState("busy");
    try {
      const res = await fetch(`/api/analyses/${requestId}/share`, { method: "POST" });
      const body = (await res.json()) as ApiResponse<{ token: string }>;
      if (!body.ok) throw new Error(body.error.message);
      const url = `${window.location.origin}/r/${body.data.token}`;
      await navigator.clipboard.writeText(url);
      setShared(true);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  }

  async function revoke() {
    setState("busy");
    try {
      await fetch(`/api/analyses/${requestId}/share`, { method: "DELETE" });
      setShared(false);
      setState("idle");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={share}
        disabled={state === "busy"}
      >
        {state === "busy" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : state === "copied" ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Link2 className="h-3.5 w-3.5" />
        )}
        {state === "copied" ? "Link copied" : state === "error" ? "Try again" : "Share report"}
      </Button>
      {shared && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={revoke}
          disabled={state === "busy"}
          title="Revoke the share link"
        >
          <X className="h-3.5 w-3.5" />
          Revoke
        </Button>
      )}
    </div>
  );
}
