"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  Radar,
  Search,
  Scale,
} from "lucide-react";
import { APP_NAME, type ApiResponse, type JobStatus } from "@kol-fit/shared";

import { cn } from "@/lib/utils";
import type { AnalysisStatusResponse } from "@/lib/analysis-status";
import { AudienceField } from "@/components/audience-field";
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

  // Ready-notification (Unit 39): analyses take ~2 minutes and people tab
  // away — flash the tab title when the run finishes while the tab is hidden,
  // restore it when they come back. Dependency-free (no permission prompts).
  const status = data?.job.status;
  React.useEffect(() => {
    if (status !== "COMPLETED" && status !== "FAILED") return;
    if (typeof document === "undefined" || !document.hidden) return;
    const original = document.title;
    document.title =
      status === "COMPLETED"
        ? `✅ Report ready | ${APP_NAME}`
        : `⚠️ Analysis failed | ${APP_NAME}`;
    const restore = () => {
      document.title = original;
    };
    document.addEventListener("visibilitychange", restore, { once: true });
    return () => {
      document.removeEventListener("visibilitychange", restore);
      document.title = original;
    };
  }, [status]);

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
              className="inline-flex h-9 items-center gap-2 rounded-full border border-strong bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:bg-elevated"
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

  // In-flight: the immersive "what's happening & why it's worth the wait" view.
  if (job.status === "QUEUED" || job.status === "RUNNING") {
    return (
      <StatusShell>
        <RunningExperience data={data} />
      </StatusShell>
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
              <CardDescription>Fit analysis</CardDescription>
            </div>
            <StatusBadge status={job.status} />
          </div>
        </CardHeader>
        <CardContent>
          {job.status === "COMPLETED" &&
            (report ? (
              <CompletedBody data={data} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Completed, but the report is unavailable.
              </p>
            ))}
          {job.status === "FAILED" && (
            <FailedBody
              job={job}
              requestId={data.id}
              onRetried={() => setReloadKey((k) => k + 1)}
            />
          )}
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
    accent: "text-accent-ink",
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

// Client-facing progress stages (Unit 33: outcome language only — no pipeline
// mechanics, counts, provider or model details). `until` = cumulative seconds
// by which a typical run has usually reached the *next* stage; used only to
// estimate which stage is likely active (the elapsed timer is the truthful
// anchor — we never claim a precise percentage).
const STAGES: {
  icon: React.ReactNode;
  title: string;
  why: string;
  until: number;
}[] = [
  {
    icon: <Search className="h-4 w-4" />,
    title: "Reading the public presence",
    why: "Getting to know the brand and the creator: what they publish and what they stand for.",
    until: 35,
  },
  {
    icon: <Radar className="h-4 w-4" />,
    title: "Measuring the real audience",
    why: "Looking past follower counts at the people who actually engage. This deep pass is the slow part, and the whole point.",
    until: 210,
  },
  {
    icon: <Scale className="h-4 w-4" />,
    title: "Evaluating audience quality & fit",
    why: "Weighing who that audience really is, how genuine it is, and how well it matches your target users.",
    until: 330,
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: "Preparing your report",
    why: "Turning everything into a scorecard, a verdict, and concrete recommendations.",
    until: Number.POSITIVE_INFINITY,
  },
];

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function RunningExperience({ data }: { data: AnalysisStatusResponse }) {
  const { job } = data;
  const queued = job.status === "QUEUED";

  // Live elapsed clock (ticks every second, independent of the 2.5s poll).
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startedAt = job.startedAt ? new Date(job.startedAt).getTime() : null;
  const elapsed = startedAt ? Math.max(0, Math.floor((nowMs - startedAt) / 1000)) : 0;
  const activeIdx = queued
    ? -1
    : Math.min(STAGES.findIndex((s) => elapsed < s.until), STAGES.length - 1);
  const overrun = elapsed > 430; // past the usual window

  return (
    <div className="relative overflow-hidden rounded-2xl border border-default bg-surface shadow-card">
      {/* the audience being sifted, quietly alive behind the panel */}
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <AudienceField className="h-full w-full" />
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(var(--field-veil),0.58), rgba(var(--field-veil),0.85))",
        }}
      />

      <div className="relative p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">
              @{data.orgHandle}{" "}
              <span className="text-muted-foreground">vs</span> @{data.kolHandle}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Deep fit analysis in progress
            </div>
          </div>
          <StatusBadge status={job.status} />
        </div>

        {/* timer + estimate */}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {queued ? "Waiting to start" : "Elapsed"}
            </div>
            <div className="font-mono text-4xl font-semibold text-foreground">
              {queued ? "—" : mmss(elapsed)}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-secondary-foreground">
            <Clock className="h-4 w-4 text-accent-ink" />
            {queued
              ? "Queued. A worker will pick this up shortly."
              : overrun
                ? "Taking a little longer than usual. Hang tight."
                : "Most analyses finish in about 5–7 minutes."}
          </div>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-inset">
          <div className="indeterminate h-full w-1/3 rounded-full bg-accent-primary" />
        </div>

        {/* staged walkthrough — what's happening & why it's worth the wait */}
        <ol className="mt-7 space-y-1.5">
          {STAGES.map((stage, i) => {
            const done = activeIdx > i;
            const active = activeIdx === i;
            return (
              <li
                key={i}
                className={cn(
                  "rounded-xl border px-3.5 py-3 transition-colors",
                  active
                    ? "border-accent-primary/40 bg-elevated/70"
                    : "border-transparent"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      done
                        ? "bg-success/15 text-success"
                        : active
                          ? "bg-accent-primary/15 text-accent-ink"
                          : "bg-elevated text-muted-foreground"
                    )}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : active ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      stage.icon
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      active || done ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {stage.title}
                  </span>
                </div>
                {active && (
                  <p className="mt-2 pl-[38px] text-[13px] leading-relaxed text-secondary-foreground">
                    {stage.why}
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        <p className="mt-6 text-xs text-muted-foreground">
          This page updates automatically, so there&apos;s no need to refresh.
          You can leave and come back from{" "}
          <Link href="/analyses" className="text-accent-ink hover:underline">
            History
          </Link>
          .
        </p>
      </div>
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

function FailedBody({
  job,
  requestId,
  onRetried,
}: {
  job: AnalysisStatusResponse["job"];
  requestId: string;
  onRetried: () => void;
}) {
  const [retrying, setRetrying] = React.useState(false);
  const [retryError, setRetryError] = React.useState<string | null>(null);

  // Manual retry (Unit 40): re-queues the same analysis — the caches make the
  // re-run fast — then re-enters the queued/running experience.
  async function retry() {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/analyses/${requestId}/retry`, {
        method: "POST",
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (body.ok) {
        onRetried();
        return;
      }
      setRetryError(body.error?.message ?? "Could not retry. Please try again.");
    } catch {
      setRetryError("Network error. Please try again.");
    } finally {
      setRetrying(false);
    }
  }

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
        <p className="text-xs text-secondary-foreground">
          Failed runs don&apos;t count against your analyses. Retrying is free.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-mono text-xs text-muted-foreground">
          {job.errorCode && <span>{job.errorCode}</span>}
          {job.attempts > 1 && <span>{job.attempts} attempts</span>}
          {job.failedAt && (
            <span>Failed {new Date(job.failedAt).toLocaleString()}</span>
          )}
        </div>
      </div>

      {retryError && (
        <p className="text-xs text-error" role="alert">
          {retryError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button size="sm" onClick={retry} disabled={retrying}>
          {retrying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Retry analysis
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Start a new analysis</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/analyses">Back to reports</Link>
        </Button>
      </div>
    </div>
  );
}
