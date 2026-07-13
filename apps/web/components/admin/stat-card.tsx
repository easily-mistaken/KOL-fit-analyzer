import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * One KPI: a label, a big mono number, and an optional secondary line. Used for
 * every tile on the overview grid so the numbers line up.
 */
export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "warning" | "error";
}) {
  return (
    <div className="rounded-xl border border-default bg-surface p-4 shadow-card">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-mono text-2xl font-semibold tabular-nums",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "error" && "text-error",
          !tone && "text-foreground"
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-secondary-foreground">{hint}</p>
      )}
    </div>
  );
}
