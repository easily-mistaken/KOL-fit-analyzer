"use client";

import * as React from "react";
import { Check, Copy, Link2, Loader2, X } from "lucide-react";

import type { ApiResponse } from "@kol-fit/shared";

import { Button } from "@/components/ui/button";

// Share-link control (Unit 38, hardened in 39.1). Minting and copying are
// separate concerns: once the link exists it is ALWAYS shown inline — a
// blocked clipboard must not read as "sharing failed".

export function ShareReport({ requestId }: { requestId: string }) {
  const [busy, setBusy] = React.useState(false);
  const [url, setUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the visible URL is the fallback.
    }
  }

  async function share() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/analyses/${requestId}/share`, { method: "POST" });
      const body = (await res.json()) as ApiResponse<{ token: string }>;
      if (!body.ok) {
        setError(body.error.message);
        return;
      }
      const link = `${window.location.origin}/r/${body.data.token}`;
      setUrl(link);
      void copyToClipboard(link);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await fetch(`/api/analyses/${requestId}/share`, { method: "DELETE" });
      setUrl(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (url) {
    return (
      <div className="flex max-w-full items-center gap-1.5">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-8 w-56 rounded-lg border border-default bg-elevated px-2.5 font-mono text-[11px] text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-accent/60"
          aria-label="Public share link"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => copyToClipboard(url)}
          disabled={busy}
          title="Copy link"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={revoke}
          disabled={busy}
          title="Revoke the share link so the URL stops working"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-error">{error}</span>}
      <Button type="button" variant="outline" size="sm" onClick={share} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
        Share report
      </Button>
    </div>
  );
}
