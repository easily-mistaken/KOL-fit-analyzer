"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { LeadCaptureInputSchema } from "@kol-fit/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContactLinks } from "@/components/contact-links";

/**
 * Email capture at the end of a finished report (Unit 44).
 *
 * Placed HERE on purpose: this is the moment the reader has just been handed
 * the thing they came for, which is the highest-willingness point in the whole
 * flow. It asks for exactly one field for the same reason — every extra input
 * at that moment costs conversion, and the richer Telegram + X ask already
 * exists on the detailed-report form for people with more intent.
 *
 * COPY CONSTRAINT: there is no mail sender wired up in this codebase, so the
 * copy must never promise an automatic email. It promises a human getting back
 * to you, which is what actually happens (the capture pings the operator's
 * Telegram). Do not change this to "we'll email it to you" without building
 * the sender first.
 */
export function EmailCapture({
  analysisRequestId,
  orgHandle,
  kolHandle,
  signedInEmail,
}: {
  analysisRequestId?: string;
  orgHandle?: string;
  kolHandle?: string;
  /** When signed in, the account email is used server-side regardless. */
  signedInEmail?: string | null;
}) {
  const [email, setEmail] = React.useState(signedInEmail ?? "");
  const [state, setState] = React.useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      email,
      source: "report" as const,
      ...(analysisRequestId ? { analysisRequestId } : {}),
      ...(orgHandle ? { orgHandle } : {}),
      ...(kolHandle ? { kolHandle } : {}),
    };
    const parsed = LeadCaptureInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }

    setState("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Could not save that. Try again?");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("Could not save that. Try again?");
      setState("idle");
    }
  }

  return (
    <div className="rounded-xl border border-default bg-elevated p-4">
      {state === "done" ? (
        <div className="flex items-start gap-2.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <div>
            <p className="text-sm font-medium text-foreground">Got it.</p>
            <p className="mt-0.5 text-[12.5px] text-secondary-foreground">
              We&apos;ll be in touch. If you&apos;d rather talk now:
            </p>
            <ContactLinks className="mt-2.5" />
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">
            Want a deeper read on this creator?
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-secondary-foreground">
            Leave your email and we&apos;ll get back to you — or reach out
            directly, whichever is faster.
          </p>

          <form onSubmit={onSubmit} className="mt-3 flex flex-wrap gap-2">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              aria-label="Your email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 min-w-[200px] flex-1"
              disabled={state === "sending"}
            />
            <Button type="submit" size="sm" disabled={state === "sending"}>
              {state === "sending" ? "Saving…" : "Send it"}
            </Button>
          </form>

          {error && (
            <p role="alert" className="mt-2 text-[12px] text-error">
              {error}
            </p>
          )}

          <ContactLinks className="mt-3 border-t border-default pt-3" />
        </>
      )}
    </div>
  );
}
