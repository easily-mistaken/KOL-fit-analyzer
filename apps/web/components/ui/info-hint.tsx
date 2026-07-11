"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Small accessible ⓘ affordance (Unit 22). Click to open a popover explaining a
 * metric; click-away or Esc to close. No external dependency — works on touch
 * and keyboard. Title + one or two short paragraphs.
 */
export function InfoHint({
  title,
  body,
  className,
}: {
  title: string;
  body: string | string[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [alignRight, setAlignRight] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);
  const paras = Array.isArray(body) ? body : [body];

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Flip to right-aligned if the popover would overflow the viewport.
  React.useLayoutEffect(() => {
    if (open && popRef.current) {
      const r = popRef.current.getBoundingClientRect();
      setAlignRight(r.right > window.innerWidth - 12);
    }
  }, [open]);

  return (
    <span ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={`What does ${title} mean?`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-grid h-4 w-4 place-content-center rounded-full border border-strong bg-elevated font-mono text-[10px] font-bold leading-none text-muted-foreground transition-colors hover:border-accent-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        i
      </button>
      {open && (
        <div
          ref={popRef}
          role="tooltip"
          className={cn(
            "absolute top-[calc(100%+8px)] z-40 w-72 rounded-md border border-strong bg-elevated p-3.5 text-left shadow-[0_10px_34px_rgba(0,0,0,0.55)]",
            alignRight ? "right-0" : "left-0"
          )}
        >
          <span
            className={cn(
              "absolute -top-[5px] h-2.5 w-2.5 rotate-45 border-l border-t border-strong bg-elevated",
              alignRight ? "right-3" : "left-3"
            )}
          />
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent-hover">
            {title}
          </p>
          {paras.map((p, i) => (
            <p
              key={i}
              className={cn(
                "text-[12.5px] leading-relaxed",
                i === 0 ? "text-secondary-foreground" : "mt-2 text-muted-foreground"
              )}
            >
              {p}
            </p>
          ))}
        </div>
      )}
    </span>
  );
}
