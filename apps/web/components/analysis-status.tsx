"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  Radar,
  Search,
  Scale,
  Users,
} from "lucide-react";
import {
  APP_NAME,
  type ApiResponse,
  type AudienceGlimpse,
  type JobStatus,
  type ProfileGlimpse,
} from "@kol-fit/shared";

import { cn } from "@/lib/utils";
import type { AnalysisStatusResponse } from "@/lib/analysis-status";
import { AudienceField } from "@/components/audience-field";
import { WaitingTips } from "@/components/waiting-tips";
import { NotifyWhenReady } from "@/components/notify-when-ready";
import { QueueNextAnalysis } from "@/components/queue-next-analysis";
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
// mechanics, counts, provider or model details). Which stage is active is now
// driven by REAL progress the worker emits (data.progress.stageIndex), not a
// stopwatch guess. `remaining` is a deliberately coarse, always-shrinking phrase
// (no false precision); `base`/`next` bound the forward-only progress bar.
const STAGES: {
  icon: React.ReactNode;
  title: string;
  why: string;
  remaining: string;
  base: number;
  next: number;
}[] = [
  {
    icon: <Search className="h-4 w-4" />,
    title: "Reading the public presence",
    why: "Getting to know the brand and the creator: what they publish and what they stand for.",
    remaining: "a few minutes",
    base: 15,
    next: 40,
  },
  {
    icon: <Radar className="h-4 w-4" />,
    title: "Measuring the real audience",
    why: "Looking past follower counts at the people who actually engage. This deep pass is the slow part, and the whole point.",
    remaining: "a couple of minutes",
    base: 40,
    next: 65,
  },
  {
    icon: <Scale className="h-4 w-4" />,
    title: "Evaluating audience quality & fit",
    why: "Weighing who that audience really is, how genuine it is, and how well it matches your target users.",
    remaining: "about a minute",
    base: 65,
    next: 88,
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: "Preparing your report",
    why: "Turning everything into a scorecard, a verdict, and concrete recommendations.",
    remaining: "almost done",
    base: 88,
    next: 97,
  },
];

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 45200 -> "45.2K", 1_200_000 -> "1.2M". Public follower counts only. */
function formatFollowers(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

/** Small avatar with a graceful initial fallback (external image may fail). */
function Avatar({ url, name }: { url?: string | null; name: string }) {
  const [ok, setOk] = React.useState(Boolean(url));
  const initial = (name.trim() || "?").charAt(0).toUpperCase();
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {ok && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setOk(false)}
        />
      ) : (
        initial
      )}
    </span>
  );
}

/** "We found them" — the real, public identity of one account. */
function GlimpseChip({ g }: { g: ProfileGlimpse }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar url={g.avatarUrl} name={g.displayName ?? g.handle} />
      <div className="min-w-0">
        <div className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
          <span className="truncate">{g.displayName ?? `@${g.handle}`}</span>
          {g.verified && (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-info" />
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          @{g.handle}
          {g.followersCount != null && (
            <> · {formatFollowers(g.followersCount)} followers</>
          )}
        </div>
      </div>
    </div>
  );
}

/** Live preview of the audience "taking shape" — real folded shares, forming
    while the report is written. Previews the payoff without leaking mechanics. */
function AudienceTakingShape({
  segments,
  kolHandle,
}: {
  segments: AudienceGlimpse[];
  kolHandle: string;
}) {
  return (
    <div className="mt-6 rounded-xl border border-accent-primary/30 bg-elevated/50 p-4">
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-accent-ink" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          The audience is taking shape
        </span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-secondary-foreground">
        A first read of who actually engages with @{kolHandle}. Your full
        breakdown lands with the report.
      </p>
      <ul className="mt-3 space-y-2.5">
        {segments.map((s) => (
          <li key={s.label}>
            <div className="flex items-baseline justify-between text-xs">
              <span
                className={cn(
                  "font-medium",
                  s.low ? "text-error" : "text-foreground"
                )}
              >
                {s.label}
              </span>
              <span className="font-mono text-muted-foreground">
                {Math.round(s.share * 100)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-inset">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  s.low ? "bg-error/70" : "bg-accent-primary"
                )}
                style={{ width: `${Math.max(2, Math.round(s.share * 100))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunningExperience({ data }: { data: AnalysisStatusResponse }) {
  const { job, progress } = data;
  const queued = job.status === "QUEUED";

  // Live clock (ticks every second, independent of the 2.5s poll) — drives the
  // elapsed readout and the smooth within-stage creep of the progress bar.
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startedAt = job.startedAt ? new Date(job.startedAt).getTime() : null;
  const elapsed = startedAt
    ? Math.max(0, Math.floor((nowMs - startedAt) / 1000))
    : 0;

  // Stage is REAL: from progress.stageIndex when the worker has emitted it, else
  // stage 0 ("reading") while running, else -1 when still queued.
  const activeIdx = queued ? -1 : progress?.stageIndex ?? 0;
  const barIdx = Math.max(0, activeIdx);
  const stage = STAGES[barIdx];

  // Forward-only bar: sits at the stage's base and creeps asymptotically toward
  // the next threshold using time-in-stage — always visibly moving, never
  // stalling, and never claiming completion (it tops out below 100 until the
  // job actually completes and the report view takes over).
  const stageStartMs = progress?.updatedAt
    ? new Date(progress.updatedAt).getTime()
    : startedAt;
  const sinceStage = stageStartMs
    ? Math.max(0, (nowMs - stageStartMs) / 1000)
    : 0;
  const creep = 1 - 1 / (1 + sinceStage / 45);
  const pct = queued ? 6 : Math.min(stage.next, stage.base + (stage.next - stage.base) * creep);

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

        {/* Real identity — the moment the tool proves it's working on THEIR
            accounts, not spinning. Appears as soon as the profiles are read. */}
        {(progress?.org || progress?.kol) && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-default bg-elevated/40 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            {progress?.org && <GlimpseChip g={progress.org} />}
            {progress?.org && progress?.kol && (
              <span className="hidden shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:inline">
                vs
              </span>
            )}
            {progress?.kol && <GlimpseChip g={progress.kol} />}
          </div>
        )}

        {/* Forward-only progress + coarse remaining (no scary "5-7 minutes"). */}
        <div className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 text-sm font-medium text-foreground">
              {queued ? "Queued — starting any second" : stage.title}
            </div>
            {!queued && (
              <div className="shrink-0 font-mono text-xs text-muted-foreground">
                {mmss(elapsed)}
              </div>
            )}
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-inset">
            <div
              className="h-full rounded-full bg-accent-primary transition-[width] duration-1000 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-secondary-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0 text-accent-ink" />
            {queued
              ? "A worker will pick this up any second."
              : overrun
                ? "Taking a little longer than usual — still going, hang tight."
                : `Working on it — ${stage.remaining} left.`}
          </div>
        </div>

        {/* Engagement first (user-directed order): give the captive user
            something to read + do right away, before the "what we're doing"
            transparency below — so the wait never reads as a bare spinner. */}
        <WaitingTips />

        {/* Queue the next creator now — this run keeps going in the background,
            and queued runs process one-at-a-time (worker is sequential) so the
            same brand isn't re-fetched/re-paid on each queued creator. */}
        <QueueNextAnalysis defaultOrg={data.orgHandle} />

        {/* What we're doing — the staged walkthrough (proof of work). */}
        <div className="mt-7 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          What we&apos;re doing
        </div>
        <ol className="mt-2 space-y-1.5">
          {STAGES.map((s, i) => {
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
                      s.icon
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      active || done ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {s.title}
                  </span>
                </div>
                {active && (
                  <p className="mt-2 pl-[38px] text-[13px] leading-relaxed text-secondary-foreground">
                    {s.why}
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        {/* Real audience preview — appears once classification produces a first
            read (the strongest "worth the wait" signal). */}
        {progress?.audience && progress.audience.length > 0 && (
          <AudienceTakingShape
            segments={progress.audience}
            kolHandle={data.kolHandle}
          />
        )}

        {/* Safe to stay OR leave: encourage staying (live), make leaving safe
            (notify + History) — no longer an invitation to abandon. */}
        <div className="mt-6 flex flex-col gap-2.5 rounded-xl border border-default bg-elevated/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-secondary-foreground">
            Keep this tab open, it updates live. Step away and we&apos;ll keep
            working; it&apos;s saved in your History.
          </p>
          <div className="shrink-0">
            <NotifyWhenReady
              status={job.status}
              orgHandle={data.orgHandle}
              kolHandle={data.kolHandle}
            />
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Updates live. No need to refresh. Everything is saved in your{" "}
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
