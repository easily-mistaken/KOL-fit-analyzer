import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
} from "lucide-react";
import type { JobStatus } from "@kol-fit/shared";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VerdictBadge } from "@/components/report/verdict-badge";
import type { AnalysisListResponse } from "@/lib/analyses-list";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DATE_FMT.format(d);
}

const JOB_STATUS_CONFIG: Record<
  JobStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  QUEUED: {
    label: "Queued",
    className: "border-info/40 text-info",
    icon: <Clock className="h-4 w-4" />,
  },
  RUNNING: {
    label: "Running",
    className: "border-info/40 text-info",
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
  },
  COMPLETED: {
    label: "Completed",
    className: "border-success/40 text-success",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  FAILED: {
    label: "Failed",
    className: "border-error/40 text-error",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
};

function JobStatusBadge({ status }: { status: JobStatus | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const { label, className, icon } = JOB_STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5", className)}>
      {icon}
      {label}
    </Badge>
  );
}

/**
 * Saved-reports list (Unit 20). Server-rendered, read-only. Each row links to
 * the full report at /analyses/[id]. Renders an empty state when there are no
 * analyses, and a cursor-based "Load more" link when more pages exist.
 */
export function AnalysesList({ data }: { data: AnalysisListResponse }) {
  if (data.items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-default bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-default text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">KOL / Org</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Verdict</th>
              <th className="px-4 py-3 text-right font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3" aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr
                key={item.id}
                className="group border-b border-default/60 transition-colors last:border-b-0 hover:bg-elevated"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/analyses/${item.id}`}
                    className="flex items-center gap-2 font-medium text-foreground"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="text-foreground">@{item.kolHandle}</span>
                      <span className="text-muted-foreground"> → @{item.orgHandle}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <JobStatusBadge status={item.jobStatus} />
                </td>
                <td className="px-4 py-3">
                  <VerdictBadge verdict={item.report?.verdict ?? null} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {typeof item.report?.overallScore === "number"
                    ? item.report.overallScore
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-secondary-foreground">
                  {formatCreatedAt(item.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/analyses/${item.id}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-accent-hover"
                  >
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.nextCursor && (
        <div className="flex justify-center">
          <Button asChild variant="outline" size="sm">
            <Link href={`/analyses?cursor=${data.nextCursor}`}>Load more</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-default bg-surface px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-elevated text-muted-foreground">
        <FileText className="h-5 w-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">No reports yet</p>
        <p className="text-sm text-muted-foreground">
          Create your first KOL fit analysis to see it here.
        </p>
      </div>
      <Button asChild size="sm">
        <Link href="/">New analysis</Link>
      </Button>
    </div>
  );
}
