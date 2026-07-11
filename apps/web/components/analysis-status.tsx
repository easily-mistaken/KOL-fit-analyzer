"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import type { ApiResponse, JobStatus } from "@kol-fit/shared";

import { cn } from "@/lib/utils";
import type { AnalysisStatusResponse } from "@/lib/analysis-status";
import { FitReportView } from "@/components/report/fit-report-view";
import { VerdictBadge } from "@/components/report/verdict-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const POLL_INTERVAL_MS = 2500;

type Phase = "loading" | "ready" | "notfound" | "error";

export function AnalysisStatus({ id }: { id: string }) {
  const [data, setData] = React.useState<AnalysisStatusResponse | null>(null);
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    let haveData = false;
    let lastStatus: JobStatus | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      let nextStatus: JobStatus | null = null;
      try {
        const res = await fetch(`/api/analyses/${id}`, { cache: "no-store" });
        const body = (await res.json()) as ApiResponse<AnalysisStatusResponse>;
        if (cancelled) return;
        if (body.ok) {
          haveData = true;
          lastStatus = body.data.job.status;
          nextStatus = lastStatus;
          setData(body.data);
          setPhase("ready");
        } else if (body.error.code === "not_found") {
          setPhase("notfound");
          return; // terminal
        } else if (!haveData) {
          setPhase("error");
          return; // initial load failed
        } else {
          nextStatus = lastStatus; // transient error: keep last data, keep polling
        }
      } catch {
        if (cancelled) return;
        if (!haveData) {
          setPhase("error");
          return;
        }
        nextStatus = lastStatus; // transient network error
      }

      // Poll again only while the job is still in flight.
      if (!cancelled && (nextStatus === "QUEUED" || nextStatus === "RUNNING")) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    setPhase("loading");
    setData(null);
    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, reloadKey]);

  if (phase === "loading") {
    return (
      <StatusShell>
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading status…
          </CardContent>
        </Card>
      </StatusShell>
    );
  }

  if (phase === "notfound") {
    return (
      <StatusShell>
        <Card>
          <CardHeader className="items-center text-center">
            <StateIcon tone="muted">
              <AlertTriangle className="h-5 w-5" />
            </StateIcon>
            <CardTitle className="text-base text-foreground">
              Analysis not found
            </CardTitle>
            <CardDescription>
              No analysis exists for this id, or it was removed.
            </CardDescription>
          </CardHeader>
        </Card>
      </StatusShell>
    );
  }

  if (phase === "error" || !data) {
    return (
      <StatusShell>
        <Card>
          <CardHeader className="items-center text-center">
            <StateIcon tone="error">
              <AlertTriangle className="h-5 w-5" />
            </StateIcon>
            <CardTitle className="text-base text-foreground">
              Couldn&apos;t load this analysis
            </CardTitle>
            <CardDescription>
              Something went wrong loading the status.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Loader2 className="h-4 w-4" />
              Try again
            </button>
          </CardContent>
        </Card>
      </StatusShell>
    );
  }

  const { job, report } = data;

  // Completed with a full report: render the wide report view (its own shell).
  if (job.status === "COMPLETED" && report?.fitReport) {
    return (
      <FitReportView
        fitReport={report.fitReport}
        scores={report.scores}
        meta={{
          orgHandle: data.orgHandle,
          kolHandle: data.kolHandle,
          requestId: data.id,
          generatedAt: report.generatedAt,
        }}
      />
    );
  }

  return (
    <StatusShell>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base text-foreground">
                @{data.orgHandle}{" "}
                <span className="text-muted-foreground">vs</span>{" "}
                @{data.kolHandle}
              </CardTitle>
              <CardDescription>
                <span className="font-mono text-xs">{data.id}</span>
              </CardDescription>
            </div>
            <StatusBadge status={job.status} />
          </div>
        </CardHeader>
        <CardContent>
          {(job.status === "QUEUED" || job.status === "RUNNING") && (
            <ProgressBody status={job.status} />
          )}
          {job.status === "COMPLETED" &&
            (report ? (
              <CompletedBody data={data} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Completed, but the report is unavailable.
              </p>
            ))}
          {job.status === "FAILED" && <FailedBody job={job} />}
        </CardContent>
      </Card>
    </StatusShell>
  );
}

function StatusShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        New analysis
      </Link>
      {children}
    </div>
  );
}

function StateIcon({
  tone,
  children,
}: {
  tone: "muted" | "error" | "success" | "accent";
  children: React.ReactNode;
}) {
  const toneClass = {
    muted: "text-muted-foreground",
    error: "text-error",
    success: "text-success",
    accent: "text-accent-hover",
  }[tone];
  return (
    <span
      className={cn(
        "mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-elevated",
        toneClass
      )}
    >
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const config: Record<
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
  const { label, className, icon } = config[status];
  return (
    <Badge variant="outline" className={cn("shrink-0 gap-1.5", className)}>
      {icon}
      {label}
    </Badge>
  );
}

function ProgressBody({ status }: { status: JobStatus }) {
  const running = status === "RUNNING";
  return (
    <div className="space-y-4 py-1">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-elevated text-accent-hover">
          {running ? (
            <Activity className="h-5 w-5" />
          ) : (
            <Clock className="h-5 w-5" />
          )}
        </span>
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            {running ? "Analysis in progress" : "Waiting to start"}
          </p>
          <p className="text-xs text-muted-foreground">
            This page updates automatically — no need to refresh.
          </p>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-inset">
        <div className="indeterminate h-full w-1/3 rounded-full bg-accent-hover" />
      </div>

      <p className="text-xs text-muted-foreground">
        Fetching posts &amp; engagement, then classifying the audience. Live
        analyses typically take a few minutes.
      </p>
    </div>
  );
}

// Fallback shown only when the job is COMPLETED and a Report row exists but its
// FitReport JSON is missing/malformed (the full report view handles the normal
// case). Renders the flat saved summary fields only.
function CompletedBody({ data }: { data: AnalysisStatusResponse }) {
  const report = data.report!;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Report data is unavailable; showing the saved summary only.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Verdict</p>
          <VerdictBadge verdict={report.verdict} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Overall score</p>
          <p className="font-mono text-sm text-foreground">
            {report.overallScore === null
              ? "—"
              : `${report.overallScore} / 100`}
          </p>
        </div>
      </div>

      {report.generatedAt && (
        <>
          <Separator />
          <p className="text-xs text-muted-foreground">
            Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}

function FailedBody({ job }: { job: AnalysisStatusResponse["job"] }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-error/40 bg-error/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-error">
          <AlertTriangle className="h-4 w-4" />
          Analysis failed
        </div>
        <p className="text-sm text-secondary-foreground">
          {job.errorMessage ?? "The analysis could not be completed."}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-mono text-xs text-muted-foreground">
          {job.errorCode && <span>{job.errorCode}</span>}
          {job.attempts > 1 && <span>{job.attempts} attempts</span>}
          {job.failedAt && (
            <span>Failed {new Date(job.failedAt).toLocaleString()}</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="sm">
          <Link href="/">Start a new analysis</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/analyses">Back to reports</Link>
        </Button>
      </div>
    </div>
  );
}
