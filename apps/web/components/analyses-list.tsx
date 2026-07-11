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
import type { JobStatus, ReportVerdict } from "@kol-fit/shared";

import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { VerdictBadge } from "@/components/report/verdict-badge";
import type { AnalysisListResponse } from "@/lib/analyses-list";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DATE_FMT.format(d);
}

const JOB_STATUS: Record<
  JobStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  QUEUED: { label: "Queued", className: "text-info", icon: <Clock className="h-3.5 w-3.5" /> },
  RUNNING: { label: "Running", className: "text-info", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  COMPLETED: { label: "Completed", className: "text-success", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  FAILED: { label: "Failed", className: "text-error", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

function StatusPill({ status }: { status: JobStatus | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const s = JOB_STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px]", s.className)}>
      {s.icon}
      {s.label}
    </span>
  );
}

function scoreColor(v: number): string {
  return v >= 65 ? "text-success" : v >= 50 ? "text-warning" : "text-error";
}

export function AnalysesList({ data }: { data: AnalysisListResponse }) {
  if (data.items.length === 0) return <EmptyState />;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-default bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_30px_rgba(0,0,0,0.35)]">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-default text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-medium">KOL / Org</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Verdict</th>
              <th className="px-5 py-3 text-right font-medium">Score</th>
              <th className="px-5 py-3 font-medium">Created</th>
              <th className="px-5 py-3" aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => {
              const verdict = (item.report?.verdict ?? null) as ReportVerdict | null;
              const score = item.report?.overallScore;
              return (
                <tr
                  key={item.id}
                  className="group border-b border-default/50 transition-colors last:border-b-0 hover:bg-elevated"
                >
                  <td className="px-5 py-3.5">
                    <Link href={`/analyses/${item.id}`} className="flex items-center gap-3">
                      <Avatar handle={item.kolHandle} size={32} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          @{item.kolHandle}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          → @{item.orgHandle}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill status={item.jobStatus} />
                  </td>
                  <td className="px-5 py-3.5">
                    <VerdictBadge verdict={verdict} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {typeof score === "number" ? (
                      <span className={cn("font-mono text-[15px] font-semibold", scoreColor(score))}>
                        {score}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                    {formatCreatedAt(item.createdAt)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/analyses/${item.id}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-accent-hover"
                    >
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
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
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-default bg-surface px-6 py-20 text-center">
      <span className="grid h-12 w-12 place-content-center rounded-xl bg-elevated text-muted-foreground">
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
