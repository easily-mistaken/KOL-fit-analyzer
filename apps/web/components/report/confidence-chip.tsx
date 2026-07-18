import type { ConfidenceLevel } from "@kol-fit/shared";

/** Compact "N confidence" chip used across the report surfaces. */
export function ConfidenceChip({ level }: { level: ConfidenceLevel }) {
  return (
    <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      {level} confidence
    </span>
  );
}
