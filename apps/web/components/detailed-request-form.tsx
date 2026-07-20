"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

import {
  DetailedReportRequestInputSchema,
  type ApiResponse,
} from "@kol-fit/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Detailed-report concierge request (Unit 35). Available at any time — the
// hands-on alternative to the self-serve run. Org/KOL prefill comes from the
// page (report CTA passes the pair + analysis id).

type Props = {
  defaultOrgHandle?: string;
  defaultKolHandle?: string;
  analysisRequestId?: string;
  /** Signed-in users' email comes from their account; anonymous visitors
   *  must provide one (Unit 36.1). */
  isAuthenticated?: boolean;
};

export function DetailedRequestForm({
  defaultOrgHandle,
  defaultKolHandle,
  analysisRequestId,
  isAuthenticated = false,
}: Props) {
  const [telegram, setTelegram] = React.useState("");
  const [xHandle, setXHandle] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [orgHandle, setOrgHandle] = React.useState(defaultOrgHandle ?? "");
  const [kolHandle, setKolHandle] = React.useState(defaultKolHandle ?? "");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isAuthenticated && !email.trim()) {
      setError("Add your email so we can follow up.");
      return;
    }

    const payload: Record<string, unknown> = { telegram, xHandle };
    if (!isAuthenticated && email.trim()) payload.email = email;
    if (orgHandle.trim()) payload.orgHandle = orgHandle;
    if (kolHandle.trim()) payload.kolHandle = kolHandle;
    if (note.trim()) payload.note = note;
    if (analysisRequestId) payload.analysisRequestId = analysisRequestId;

    const parsed = DetailedReportRequestInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/detailed-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as ApiResponse<{ id: string }>;
      if (body.ok) {
        setDone(true);
      } else {
        setError(body.error.message);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-success/40 bg-success/10 px-4 py-4 text-sm">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          Request received
        </div>
        <p className="mt-1.5 text-secondary-foreground">
          We&apos;ll reach out on Telegram within a day with your curated
          report.
        </p>
        <p className="mt-1.5 text-xs text-secondary-foreground">
          Keep an eye on your message requests — the first DM from someone you
          haven&apos;t spoken to lands there rather than your main inbox.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="dr-telegram">Telegram username</Label>
          <Input
            id="dr-telegram"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="@yourname"
            disabled={loading}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dr-x">Your X handle or profile link</Label>
          <Input
            id="dr-x"
            value={xHandle}
            onChange={(e) => setXHandle(e.target.value)}
            placeholder="@you or x.com/you"
            disabled={loading}
            required
          />
        </div>
      </div>

      {!isAuthenticated && (
        <div className="space-y-1.5">
          <Label htmlFor="dr-email">Email</Label>
          <Input
            id="dr-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@project.xyz"
            disabled={loading}
            required
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="dr-org">Organization handle (optional)</Label>
          <Input
            id="dr-org"
            value={orgHandle}
            onChange={(e) => setOrgHandle(e.target.value)}
            placeholder="@yourproject"
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dr-kol">Creator handle (optional)</Label>
          <Input
            id="dr-kol"
            value={kolHandle}
            onChange={(e) => setKolHandle(e.target.value)}
            placeholder="@thekol"
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dr-note">Anything specific you want examined? (optional)</Label>
        <Textarea
          id="dr-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Campaign goal, budget range, timing, concerns…"
          rows={3}
          maxLength={500}
          disabled={loading}
        />
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-error/40 bg-error/10 px-3 py-2.5 text-sm text-error">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} className="min-w-44">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> Request curated report
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
