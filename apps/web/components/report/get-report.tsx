"use client";

import * as React from "react";
import { CheckCircle2, Download, Loader2, Mail, Send } from "lucide-react";
import type { ApiResponse } from "@kol-fit/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DeliverResult = {
  id: string;
  emailQueued: boolean;
  telegramCaptured: boolean;
};

/**
 * Lead-capture card (Unit 24): the report is on screen, but to take a copy the
 * user leaves an email and/or Telegram. Email delivers the PDF; Telegram is
 * captured (delivery there is coming soon).
 */
export function GetReport({ requestId }: { requestId: string }) {
  const [email, setEmail] = React.useState("");
  const [telegram, setTelegram] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<DeliverResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() && !telegram.trim()) {
      setError("Enter an email or a Telegram handle.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/analyses/${requestId}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          telegramHandle: telegram.trim() || undefined,
        }),
      });
      const body = (await res.json()) as ApiResponse<DeliverResult>;
      if (body.ok) setDone(body.data);
      else setError(body.error.message);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <section className="rounded-2xl border border-success/40 bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div className="space-y-1 text-sm">
            {done.emailQueued && (
              <p className="text-foreground">
                Your report is on its way to{" "}
                <span className="font-medium">{email.trim()}</span>.
              </p>
            )}
            {done.telegramCaptured && (
              <p className="text-secondary-foreground">
                We&apos;ve saved your Telegram — delivery there is coming soon.
              </p>
            )}
            {!done.emailQueued && !done.telegramCaptured && (
              <p className="text-foreground">Thanks — we&apos;ve saved your details.</p>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-accent-primary/30 bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-accent-hover" />
        <h2 className="text-[15px] font-semibold text-foreground">
          Get the full report
        </h2>
      </div>
      <p className="mt-1 text-sm text-secondary-foreground">
        We&apos;ll email you a PDF. Add your Telegram too if you like — at least
        one.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="deliver-email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="deliver-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@company.com"
                className="pl-9"
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deliver-telegram">Telegram</Label>
            <div className="relative">
              <Send className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="deliver-telegram"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="@yourhandle"
                className="pl-9"
                disabled={loading}
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-error" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            We&apos;ll only use this to send your report.
          </p>
          <Button type="submit" disabled={loading} className="min-w-40">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Email me the report
              </>
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}
