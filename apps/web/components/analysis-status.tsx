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
import type {
  ApiResponse,
  JobStatus,
  ReportVerdict,
} from "@kol-fit/shared";

import { cn } from "@/lib/utils";
import type { AnalysisStatusResponse } from "@/lib/analysis-status";
import { Badge } from "@/components/ui/badge";
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
  return (
    <div className="flex items-center gap-3 py-2">
      <Activity className="h-5 w-5 text-accent-hover" />
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          {status === "QUEUED" ? "Waiting to start" : "Analysis in progress"}
        </p>
        <p className="text-xs text-muted-foreground">
          This page updates automatically.
        </p>
      </div>
    </div>
  );
}

const VERDICT_TONE: Record<ReportVerdict, string> = {
  STRONG: "border-success/40 text-success",
  GOOD: "border-success/40 text-success",
  OKAY: "border-warning/40 text-warning",
  WEAK: "border-error/40 text-error",
  AVOID: "border-error/40 text-error",
};

function CompletedBody({ data }: { data: AnalysisStatusResponse }) {
  const report = data.report!;
  const fit = report.fitReport;
  const placeholderNote = fit?.evidence.notes[0];
  const score = report.overallScore ?? fit?.overallScore.value ?? null;
  const confidence = fit?.confidence ?? null;

  return (
    <div className="space-y-4">
      {placeholderNote && (
        <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <span>{placeholderNote}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Verdict</p>
          {report.verdict ? (
            <Badge
              variant="outline"
              className={cn(VERDICT_TONE[report.verdict])}
            >
              {report.verdict}
            </Badge>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Overall score</p>
          <p className="font-mono text-sm text-foreground">
            {score === null ? "—" : `${score} / 100`}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Confidence</p>
          <p className="text-sm capitalize text-secondary-foreground">
            {confidence ?? "—"}
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
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-error">
        <AlertTriangle className="h-4 w-4" />
        Analysis failed
      </div>
      <p className="text-sm text-secondary-foreground">
        {job.errorMessage ?? "The analysis could not be completed."}
      </p>
      {job.errorCode && (
        <p className="font-mono text-xs text-muted-foreground">
          {job.errorCode}
        </p>
      )}
    </div>
  );
}
