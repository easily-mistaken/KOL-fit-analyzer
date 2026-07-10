import * as React from "react";
import type { ReportVerdict } from "@kol-fit/shared";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// Verdict → token-based tone. Shared by the report hero (fit-report-view) and
// the reports list so the color mapping lives in one place. Color is never the
// only signal — the verdict label text is always shown.
export const VERDICT_TONE: Record<ReportVerdict, string> = {
  STRONG: "border-success/40 text-success",
  GOOD: "border-success/40 text-success",
  OKAY: "border-warning/40 text-warning",
  WEAK: "border-error/40 text-error",
  AVOID: "border-error/40 text-error",
};

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: ReportVerdict | null;
  className?: string;
}) {
  if (!verdict) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Badge
      variant="outline"
      className={cn("text-sm", VERDICT_TONE[verdict], className)}
    >
      {verdict}
    </Badge>
  );
}
