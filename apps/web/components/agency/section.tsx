import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Reveal } from "@/components/agency/reveal";

/** Page-width section with the agency's gutters and vertical rhythm. */
export function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 sm:py-24", className)}>
      {children}
    </section>
  );
}

/** Mono eyebrow + display heading + optional lead, revealed on scroll. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  className,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  // In a two-column section the heading column must hug the top, not the
  // bottom; callers pass "md:sticky md:top-24 self-start" for that.
  return (
    <Reveal className={cn("mb-12 flex flex-col gap-6 sm:mb-16 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-3xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-4 text-[clamp(34px,5.2vw,68px)] font-semibold leading-[0.98] tracking-[-0.035em] text-balance text-foreground">
          {title}
        </h2>
        {lead ? (
          <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-secondary-foreground sm:text-lg">{lead}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </Reveal>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-secondary-foreground",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-[1px] bg-accent-primary" />
      {children}
    </span>
  );
}
