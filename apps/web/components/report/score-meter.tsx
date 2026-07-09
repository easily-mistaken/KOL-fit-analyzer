import * as React from "react";
import type { ConfidenceLevel, ScoreValue } from "@kol-fit/shared";

import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "error";
type Kind = "fit" | "risk";

const FILL: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
};
const TEXT: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

// Fit metrics: higher = better. Risk metrics: higher = worse (colors inverted).
function toneFor(value: number, kind: Kind): Tone {
  if (kind === "risk") {
    if (value >= 60) return "error";
    if (value >= 30) return "warning";
    return "success";
  }
  if (value >= 65) return "success";
  if (value >= 40) return "warning";
  return "error";
}

export function ConfidenceChip({ level }: { level: ConfidenceLevel }) {
  return (
    <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      {level} confidence
    </span>
  );
}

/**
 * Renders one saved ScoreValue as a labelled CSS bar. Purely presentational —
 * `value` comes straight from the DB; the only "math" is mapping value → bar
 * width and a color band. Risk mode inverts the color scale and labels the
 * direction so a green risk bar can't be misread as good.
 */
export function ScoreMeter({
  label,
  score,
  kind = "fit",
  showReasons = false,
}: {
  label: string;
  score: ScoreValue;
  kind?: Kind;
  showReasons?: boolean;
}) {
  const width = Math.max(0, Math.min(100, score.value));
  const tone = toneFor(score.value, kind);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-foreground">{label}</span>
        <span className={cn("font-mono text-sm", TEXT[tone])}>
          {score.value} / 100
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
        <div
          className={cn("h-full rounded-full", FILL[tone])}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <ConfidenceChip level={score.confidence} />
        {kind === "risk" && (
          <span className="text-[11px] font-medium text-muted-foreground">
            Risk · higher is worse
          </span>
        )}
      </div>
      {showReasons && score.reasons.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {score.reasons.map((r, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-muted-foreground/60">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
