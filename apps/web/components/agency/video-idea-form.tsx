"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, Plus } from "lucide-react";

import {
  IDEA_BUDGETS,
  IDEA_CONTACT_CHANNELS,
  IDEA_STYLES,
  type IdeaContactChannel,
  type IdeaSource,
} from "@kol-fit/shared/video-idea-options";
import { LAUNCH_GALLERY } from "@/lib/agency/content";
import { cn } from "@/lib/utils";

const FIELD =
  "h-12 w-full min-w-0 rounded-xl border border-strong bg-base px-4 text-[16px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent-primary disabled:opacity-60";
const LABEL = "text-sm font-medium text-foreground";
const PILL =
  "inline-flex min-h-11 items-center rounded-full border border-strong px-4 text-sm text-secondary-foreground transition-colors hover:text-foreground peer-checked:border-accent-primary peer-checked:bg-accent-primary/15 peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring";

const PLACEHOLDER: Record<IdeaContactChannel, string> = {
  email: "you@company.com",
  x: "@yourname",
  telegram: "@yourname",
};

function Optional() {
  return <span className="font-normal text-muted-foreground"> (optional)</span>;
}

/** One choice as pills: native radios, so it is keyboard and form friendly. */
function Pills({ name, options, onPick }: { name: string; options: Record<string, string>; onPick?: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(options).map(([value, label]) => (
        <label key={value} className="cursor-pointer">
          <input type="radio" name={name} value={value} onChange={onPick} className="peer sr-only" />
          <span className={PILL}>{label}</span>
        </label>
      ))}
    </div>
  );
}

type State = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string } | { kind: "done"; contact: string };

/**
 * "Get a free video idea" (Unit 57), the same questions as the form on
 * launchgallery.video: what you are launching, a budget range, where to send
 * the idea, plus optional style and links. Posts to /api/video-ideas.
 */
export function VideoIdeaForm({ source }: { source: IdeaSource }) {
  const uid = useId();
  const [channel, setChannel] = useState<IdeaContactChannel>("email");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [budgetMissing, setBudgetMissing] = useState(false);
  const budgetRef = useRef<HTMLFieldSetElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const sending = state.kind === "sending";

  // The thank-you card is much shorter than the form it replaces, so on a
  // phone it would land above the viewport: bring it into view and focus it.
  useEffect(() => {
    if (state.kind !== "done" || !doneRef.current) return;
    doneRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    doneRef.current.focus({ preventScroll: true });
  }, [state.kind]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    // Budget is checked here rather than with `required` on the hidden radios,
    // whose native bubble shows up in the wrong place on phones.
    if (!form.get("budget")) {
      setBudgetMissing(true);
      budgetRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    const body = Object.fromEntries(form.entries());
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/video-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, contactChannel: channel, source }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setState({ kind: "done", contact: json.data.contact || "you" });
      } else {
        setState({ kind: "error", message: json?.error?.message ?? "Could not send that. Please try again." });
      }
    } catch {
      setState({ kind: "error", message: "Could not send that. Check your connection and try again." });
    }
  }

  if (state.kind === "done") {
    return (
      <div ref={doneRef} tabIndex={-1} className="scroll-mt-24 rounded-3xl border border-default bg-surface p-6 outline-none sm:p-8" role="status">
        <CheckCircle2 className="h-9 w-9 text-accent-ink" aria-hidden />
        <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Thanks, we got it.</h3>
        <p className="mt-2 leading-relaxed text-secondary-foreground">
          We&apos;ll send your free video idea to <span className="font-medium text-foreground">{state.contact}</span>.
        </p>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">While you wait</p>
        <ul className="mt-3 grid gap-3">
          <li>
            <a
              href={LAUNCH_GALLERY.url}
              target="_blank"
              rel="noopener"
              className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-default px-5 py-3 text-foreground transition-colors hover:bg-elevated"
            >
              <span>
                <span className="block font-medium">Find inspiration on {LAUNCH_GALLERY.name}</span>
                <span className="block text-sm text-secondary-foreground">Launch videos that performed, with their views</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
          <li>
            <Link
              href="/creator-fit"
              className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-default px-5 py-3 text-foreground transition-colors hover:bg-elevated"
            >
              <span>
                <span className="block font-medium">Check if a creator is a good fit</span>
                <span className="block text-sm text-secondary-foreground">Free with Creator Fit, before you pay for a post</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-3xl border border-default bg-surface p-6 sm:p-8" noValidate={false}>
      <div className="grid gap-2">
        <label htmlFor={`${uid}-brief`} className={LABEL}>
          What are you launching?
        </label>
        <input
          id={`${uid}-brief`}
          name="brief"
          required
          minLength={3}
          maxLength={300}
          autoComplete="off"
          placeholder="e.g. Our wallet's new swap feature"
          disabled={sending}
          className={FIELD}
        />
      </div>

      <fieldset ref={budgetRef} className="grid scroll-mt-24 gap-3" disabled={sending} aria-describedby={budgetMissing ? `${uid}-budget-error` : undefined}>
        <legend className={cn(LABEL, "mb-3")}>Your budget</legend>
        <Pills name="budget" options={IDEA_BUDGETS} onPick={() => setBudgetMissing(false)} />
        {budgetMissing ? (
          <p id={`${uid}-budget-error`} role="alert" className="text-sm text-accent-ink">
            Pick a budget range.
          </p>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-3" disabled={sending}>
        <legend className={cn(LABEL, "mb-3")}>
          Video style
          <Optional />
        </legend>
        <Pills name="style" options={IDEA_STYLES} />
      </fieldset>

      <fieldset className="grid gap-3" disabled={sending}>
        <legend className={cn(LABEL, "mb-3")}>Where should we send it?</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="inline-flex shrink-0 self-start rounded-xl border border-strong p-1" role="group" aria-label="Contact method">
            {(Object.keys(IDEA_CONTACT_CHANNELS) as IdeaContactChannel[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={channel === c}
                onClick={() => setChannel(c)}
                className={cn(
                  "inline-flex h-10 min-w-11 items-center justify-center rounded-lg px-3.5 text-sm font-medium text-secondary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  channel === c && "bg-accent-primary/15 text-foreground"
                )}
              >
                {IDEA_CONTACT_CHANNELS[c]}
              </button>
            ))}
          </div>
          <input
            key={channel}
            name="contactValue"
            aria-label={`Your ${IDEA_CONTACT_CHANNELS[channel]}`}
            type={channel === "email" ? "email" : "text"}
            inputMode={channel === "email" ? "email" : "text"}
            autoComplete={channel === "email" ? "email" : "off"}
            required
            placeholder={PLACEHOLDER[channel]}
            className={cn(FIELD, "sm:flex-1")}
          />
        </div>
      </fieldset>

      <details className="group">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm text-secondary-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          <Plus className="h-4 w-4 shrink-0 transition-transform group-open:rotate-45" aria-hidden />
          <span>
            Add your product or a video you like
            <Optional />
          </span>
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor={`${uid}-product`} className={LABEL}>
              Product link
            </label>
            <input id={`${uid}-product`} name="productUrl" inputMode="url" maxLength={500} placeholder="yourproduct.com" disabled={sending} className={FIELD} />
          </div>
          <div className="grid gap-2">
            <label htmlFor={`${uid}-reference`} className={LABEL}>
              A video you like
            </label>
            <input
              id={`${uid}-reference`}
              name="referenceUrl"
              inputMode="url"
              maxLength={500}
              placeholder="Link from X, YouTube or Launch Gallery"
              disabled={sending}
              className={FIELD}
            />
          </div>
        </div>
      </details>

      {/* Honeypot: hidden from people, tempting for bots. */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor={`${uid}-hp`}>Leave this field empty</label>
        <input id={`${uid}-hp`} name="hp_note" type="text" tabIndex={-1} autoComplete="off" data-1p-ignore data-lpignore="true" />
      </div>

      {state.kind === "error" ? (
        <p role="alert" className="rounded-xl border border-strong bg-base px-4 py-3 text-sm text-foreground">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-accent-primary px-7 text-[15px] font-medium text-accent-contrast transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-base disabled:opacity-70 sm:w-auto"
      >
        {sending ? "Sending…" : "Get my free video idea"}
        {sending ? null : <ArrowRight className="h-4 w-4" aria-hidden />}
      </button>
      <p className="text-xs text-muted-foreground">Free, no call needed. We only use your contact to send the idea.</p>
    </form>
  );
}
