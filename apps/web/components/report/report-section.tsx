import * as React from "react";

/** Consistent titled block for a report section. */
export function ReportSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/** A muted bulleted list; renders nothing when empty. */
export function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm text-secondary-foreground">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Small inline tag row (themes/verticals/signals). */
export function ChipRow({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-md border border-border bg-elevated px-2 py-0.5 text-xs text-secondary-foreground"
        >
          {item}
        </span>
      ))}
    </div>
  );
}
