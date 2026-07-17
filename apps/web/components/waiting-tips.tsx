"use client";

import * as React from "react";
import { ChevronRight, Lightbulb } from "lucide-react";

import { APP_NAME } from "@kol-fit/shared";

import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo-mark";
import {
  CREATOR_MARKETING_TIPS,
  type CreatorTip,
} from "@/lib/creator-marketing-tips";

const ROTATE_MS = 8000;

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * "While you wait" card for the analysis running screen. A run takes ~5-7
 * minutes; this fills that dead time with genuinely useful creator-marketing
 * tips (the audience here is a brand about to spend on a creator).
 *
 * Auto-advances every ROTATE_MS, pauses on hover/focus, and can be advanced
 * manually. Order is shuffled once on mount so it isn't the same sequence every
 * run; the shuffle runs in an effect (not during render) to stay deterministic
 * for the first paint. Honours prefers-reduced-motion by dropping the fade.
 */
export function WaitingTips() {
  const [order, setOrder] = React.useState<CreatorTip[]>(CREATOR_MARKETING_TIPS);
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);

  // Shuffle once, client-side, so the first paint is stable.
  React.useEffect(() => {
    setOrder(shuffle(CREATOR_MARKETING_TIPS));
  }, []);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Keyed on `index` so each tip gets a fresh countdown — a manual advance
  // resets the timer instead of firing an auto-advance moments later.
  React.useEffect(() => {
    if (paused || order.length <= 1) return;
    const id = setTimeout(
      () => setIndex((v) => (v + 1) % order.length),
      ROTATE_MS
    );
    return () => clearTimeout(id);
  }, [index, paused, order.length]);

  const tip = order[index] ?? order[0];
  const next = () => setIndex((v) => (v + 1) % order.length);

  return (
    <section
      aria-label="While you wait"
      className="mt-6 rounded-xl border border-default bg-elevated/50 p-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5 text-accent-ink" />
          While you wait
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {index + 1}/{order.length}
          </span>
          <button
            type="button"
            onClick={next}
            aria-label="Next tip"
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        key={index}
        className={cn("mt-2.5", !reduced && "animate-in fade-in duration-500")}
      >
        <span className="inline-block rounded-full border border-accent-primary/30 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-ink">
          {tip.tag}
        </span>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {tip.text}
        </p>
      </div>

      {/* Brand signature. These tip cards get screenshotted, so the mark and
          tagline ride along, turning the wait into a small marketing surface.
          Kept outside the keyed tip so it doesn't re-fade on every rotation. */}
      <div className="mt-3 flex items-center justify-between border-t border-default pt-2.5">
        <div className="flex items-center gap-1.5">
          <LogoMark className="h-4 w-4" />
          <span className="text-[11px] font-semibold tracking-tight text-secondary-foreground">
            {APP_NAME}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          who actually listens
        </span>
      </div>
    </section>
  );
}
