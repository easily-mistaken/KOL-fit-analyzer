"use client";

import * as React from "react";
import { CheckCircle2, Heart, Loader2, Send } from "lucide-react";

import {
  LimitRaiseRequestInputSchema,
  type ApiResponse,
} from "@kol-fit/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Allowance-raise request (Unit 47). Signed-in only (the page gates it). We ask
// for a way to reach the user for feedback — warmly, and with more than one
// channel offered — because an approval is a favour and the feedback is the
// point. At least one channel is required (enforced by the schema).

type Props = {
  currentLimit: number;
  requestedLimit: number;
  accountEmail?: string | null;
};

export function LimitRequestForm({
  currentLimit,
  requestedLimit,
  accountEmail,
}: Props) {
  const [telegram, setTelegram] = React.useState("");
  const [email, setEmail] = React.useState(accountEmail ?? "");
  const [otherLabel, setOtherLabel] = React.useState("");
  const [otherValue, setOtherValue] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload: Record<string, unknown> = {};
    if (telegram.trim()) payload.contactTelegram = telegram;
    if (email.trim()) payload.contactEmail = email;
    if (otherLabel.trim()) payload.contactOtherLabel = otherLabel;
    if (otherValue.trim()) payload.contactOtherValue = otherValue;
    if (note.trim()) payload.note = note;

    const parsed = LimitRaiseRequestInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/limit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as ApiResponse<{ requestedLimit: number }>;
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
          Request received. Thank you, genuinely
        </div>
        <p className="mt-1.5 text-secondary-foreground">
          We&apos;ll review it and bump you up to {requestedLimit} analyses
          soon. When we do, we&apos;ll reach out on the channel you left. We
          really do read every reply.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* The ask, said plainly and warmly. */}
      <div className="flex gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3.5 text-sm">
        <Heart className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
        <p className="text-secondary-foreground">
          We&apos;re a tiny team building this in the open, and it means a lot
          that you want to keep going. We&apos;ll happily unlock more. All we
          ask in return is a way to reach you, so we can hear what&apos;s working
          and what isn&apos;t. Your feedback is genuinely what makes this better.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lr-telegram">Telegram username</Label>
        <Input
          id="lr-telegram"
          value={telegram}
          onChange={(e) => setTelegram(e.target.value)}
          placeholder="@yourname"
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lr-email">Email</Label>
        <Input
          id="lr-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@project.xyz"
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Another channel</Label>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,9rem)_1fr]">
          <Input
            aria-label="Channel name"
            value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
            placeholder="Discord, phone…"
            disabled={loading}
          />
          <Input
            aria-label="Channel contact"
            value={otherValue}
            onChange={(e) => setOtherValue(e.target.value)}
            placeholder="your handle or number"
            disabled={loading}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Leave any one of these, whatever&apos;s easiest for you.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="lr-note">Anything you want to tell us? (optional)</Label>
        <Textarea
          id="lr-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What are you using this for? What would make it more useful?"
          rows={3}
          maxLength={500}
          disabled={loading}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-error/40 bg-error/10 px-3 py-2.5 text-sm text-error"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          Unlocks{" "}
          <span className="font-mono text-foreground">
            {currentLimit} → {requestedLimit}
          </span>{" "}
          once approved
        </span>
        <Button type="submit" disabled={loading} className="min-w-44">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> Request {requestedLimit} analyses
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
