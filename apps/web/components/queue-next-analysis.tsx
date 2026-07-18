"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Loader2, Plus } from "lucide-react";

import { type ApiResponse } from "@kol-fit/shared";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Queued = { id: string; org: string; kol: string };
type AnalysisCreated = { id: string; jobId: string; status: string };

/**
 * "Line up your next creator" — a compact form on the waiting screen. A brand
 * evaluating creators rarely checks just one, and the current analysis already
 * runs in the background, so the highest-value thing a captive user can do while
 * they wait is queue the next comparison. Each queued run opens in a new tab, so
 * this page (and the run it's watching) is never lost. Increases core usage AND
 * gives the wait a purpose.
 */
export function QueueNextAnalysis({ defaultOrg }: { defaultOrg?: string }) {
  const [org, setOrg] = React.useState(defaultOrg ?? "");
  const [kol, setKol] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [gate, setGate] = React.useState<
    "login_required" | "upgrade_required" | null
  >(null);
  const [queued, setQueued] = React.useState<Queued[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGate(null);
    const orgHandle = org.trim();
    const kolHandle = kol.trim();
    if (!orgHandle || !kolHandle) {
      setError("Enter both a brand and a creator handle.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgHandle, kolHandle }),
      });
      const body = (await res.json()) as ApiResponse<AnalysisCreated>;
      if (body.ok) {
        setQueued((q) => [
          { id: body.data.id, org: orgHandle, kol: kolHandle },
          ...q,
        ]);
        setKol(""); // keep the brand, clear the creator for the next one
        return;
      }
      if (
        body.error.code === "login_required" ||
        body.error.code === "upgrade_required"
      ) {
        setGate(body.error.code);
      }
      setError(body.error.message);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-default bg-elevated/50 p-4">
      <div className="flex items-center gap-1.5">
        <Plus className="h-3.5 w-3.5 text-accent-ink" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Line up your next creator
        </span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-secondary-foreground">
        Comparing a few creators? Start the next one now. This analysis keeps
        running in the background and stays in your History.
      </p>

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          placeholder="@yourbrand"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={loading}
          className="h-9 min-w-0 flex-1 basis-32"
          aria-label="Your brand handle"
        />
        <span className="text-xs text-muted-foreground">vs</span>
        <Input
          value={kol}
          onChange={(e) => setKol(e.target.value)}
          placeholder="@creator"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={loading}
          className="h-9 min-w-0 flex-1 basis-32"
          aria-label="Creator handle"
        />
        <Button type="submit" size="sm" disabled={loading} className="shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Queue
        </Button>
      </form>

      {error && gate === null && (
        <p
          className="mt-2 flex items-start gap-1.5 text-xs text-error"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {gate !== null && (
        <div
          role="alert"
          className="mt-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2.5 text-xs"
        >
          <p className="text-secondary-foreground">{error}</p>
          <Link
            href={gate === "login_required" ? "/login" : "/detailed"}
            className="mt-1.5 inline-block font-medium text-accent-ink hover:underline"
          >
            {gate === "login_required"
              ? "Sign in to continue →"
              : "Request a curated report →"}
          </Link>
        </div>
      )}

      {queued.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {queued.map((q) => (
            <li
              key={q.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-default bg-surface px-3 py-2 text-xs"
            >
              <span className="min-w-0 truncate font-medium text-foreground">
                @{q.org} <span className="text-muted-foreground">vs</span> @
                {q.kol}
                <span className="ml-2 font-normal text-success">queued</span>
              </span>
              <Link
                href={`/analyses/${q.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-medium text-accent-ink transition-colors",
                  "hover:bg-elevated"
                )}
              >
                Open
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
