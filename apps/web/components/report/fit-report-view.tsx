import * as React from "react";
import Link from "next/link";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import type {
  FitReport,
  ReportVerdict,
  ScoreBreakdown,
  ScoreMetric,
  ScoreValue,
} from "@kol-fit/shared";

import { cn } from "@/lib/utils";
import { METRIC_INFO } from "@/lib/metric-info";
import { Avatar } from "@/components/ui/avatar";
import { ConfidenceChip } from "@/components/report/confidence-chip";
import { ScoreGauge } from "@/components/report/score-gauge";
import { AudienceDonut } from "@/components/report/audience-donut";
import { MetricGroups, type MetricMap } from "@/components/report/metric-groups";
import { ShareReport } from "@/components/report/share-report";
import {
  AudienceGeography,
  ExpectedReachCard,
  MatchedAgainst,
} from "@/components/report/audience-dials";

// ---- verdict presentation -------------------------------------------------
const VERDICT: Record<ReportVerdict, { word: string; tone: string }> = {
  STRONG: { word: "Strong fit", tone: "var(--state-success)" },
  GOOD: { word: "Good fit", tone: "var(--state-success)" },
  OKAY: { word: "Okay fit", tone: "var(--state-warning)" },
  WEAK: { word: "Weak fit", tone: "var(--state-error)" },
  AVOID: { word: "Avoid", tone: "var(--state-error)" },
};

const RISK_METRICS = new Set<ScoreMetric>(["paid_promo_risk", "bot_farm_risk"]);

// v3 (Unit 41): the fit score IS engaged_audience_match. Content/goal/geo are
// shown for context but do NOT move the score, so they must never appear as
// score "drivers" in the hero strip.
const INFORMATIONAL_METRICS = new Set<ScoreMetric>([
  "content_fit",
  "campaign_goal_fit",
  "geo_language_fit",
]);

function formatFollowers(n: number | undefined): string | null {
  if (typeof n !== "number") return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${n}`;
}

function Party({
  handle,
  role,
  profile,
}: {
  handle: string;
  role: string;
  profile?: { displayName?: string; avatarUrl?: string; followersCount?: number; verified?: boolean } | null;
}) {
  const followers = formatFollowers(profile?.followersCount);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar
        handle={handle}
        avatarUrl={profile?.avatarUrl}
        verified={profile?.verified}
        size={40}
      />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">
          @{handle}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {role}
          {followers ? ` · ${followers} followers` : ""}
        </div>
      </div>
    </div>
  );
}

// ---- text helpers ---------------------------------------------------------
function splitSentences(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(/(?<=[.!?])\s+(?=[A-Z"'@])/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// Merge the full ScoreBreakdown (authoritative) with metrics embedded in the
// FitReport (fallback when scores is null). No recomputation.
function collectMetrics(fit: FitReport, scores: ScoreBreakdown | null): MetricMap {
  const metrics: MetricMap = {};
  if (scores) {
    metrics.overall_fit = scores.overall;
    Object.assign(metrics, scores.components);
  }
  const fallback: Partial<Record<ScoreMetric, ScoreValue | undefined>> = {
    overall_fit: fit.overallScore,
    engaged_audience_match: fit.audienceMatch?.score,
    paid_promo_risk: fit.paidPromo?.riskScore,
    bot_farm_risk: fit.botFarmRisk?.riskScore,
    brand_safety: fit.brandSafety?.score,
    geo_language_fit: fit.geoLanguageFit?.score,
  };
  for (const [k, v] of Object.entries(fallback)) {
    const key = k as ScoreMetric;
    if (!metrics[key] && v) metrics[key] = v;
  }
  return metrics;
}

type Driver = { label: string; value: number };
// What's lifting vs. holding back the overall, read straight from the scored
// metric VALUES. The raw scoring `reasons` strings are intentionally NOT
// rendered (Unit 33: they describe internal methodology). Risk metrics only
// ever count against a pairing, so an elevated one lands on the "held back"
// side.
function computeDrivers(metrics: MetricMap): { pos: Driver[]; neg: Driver[] } {
  const pos: Driver[] = [];
  const neg: Driver[] = [];
  for (const [k, score] of Object.entries(metrics)) {
    const metric = k as ScoreMetric;
    if (metric === "overall_fit" || INFORMATIONAL_METRICS.has(metric) || !score) {
      continue;
    }
    const label = METRIC_INFO[metric]?.label ?? metric;
    if (RISK_METRICS.has(metric)) {
      if (score.value >= 55) neg.push({ label, value: score.value });
    } else if (score.value >= 65) {
      pos.push({ label, value: score.value });
    } else if (score.value < 45) {
      neg.push({ label, value: score.value });
    }
  }
  pos.sort((a, b) => b.value - a.value);
  neg.sort((a, b) => a.value - b.value);
  return { pos: pos.slice(0, 3), neg: neg.slice(0, 3) };
}

// The one line that reconciles the headline number with the metric bars below:
// the reader sees a mediocre overall sitting next to several high scores, and
// this says, at a glance, which metrics pulled it each way. Sits inside the
// hero, directly under the score, so number and reason are never separated.
function DriverStrip({ pos, neg }: { pos: Driver[]; neg: Driver[] }) {
  if (pos.length === 0 && neg.length === 0) return null;
  const fmt = (ds: Driver[]) => ds.slice(0, 2).map((d) => d.label).join(" · ");
  return (
    <div className="relative grid gap-x-8 gap-y-2.5 border-t border-default/70 px-6 py-3.5 pl-7 text-[13px] sm:grid-cols-2">
      <div className="flex items-start gap-2">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-medium text-muted-foreground">Lifted by</span>
          <span className={pos.length ? "text-foreground" : "text-muted-foreground"}>
            {pos.length ? fmt(pos) : "no standout strengths"}
          </span>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-error" />
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-medium text-muted-foreground">Held back by</span>
          <span className={neg.length ? "text-foreground" : "text-muted-foreground"}>
            {neg.length ? fmt(neg) : "no major concerns"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---- small building blocks ------------------------------------------------
function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-default bg-surface p-5 shadow-card sm:p-6",
        className
      )}
    >
      {title && (
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <span className="h-px flex-1 bg-gradient-to-r from-default to-transparent" />
        </div>
      )}
      {children}
    </section>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span
          key={i}
          className="rounded-lg border border-default bg-elevated px-2.5 py-1 text-xs text-secondary-foreground"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

// ---- main -----------------------------------------------------------------
export function FitReportView({
  fitReport,
  scores,
  meta,
  mode = "owner",
}: {
  fitReport: FitReport;
  scores: ScoreBreakdown | null;
  meta: {
    orgHandle: string;
    kolHandle: string;
    requestId: string;
    generatedAt: string | null;
  };
  /** "public" = shared-link view (Unit 38): no owner navigation/actions. */
  mode?: "owner" | "public";
}) {
  const metrics = collectMetrics(fitReport, scores);
  const overall = scores?.overall ?? fitReport.overallScore;
  const confidence = scores?.confidence ?? fitReport.confidence;
  const verdict = fitReport.verdict;
  const v = VERDICT[verdict];

  // Takeaways: authored points if present, else sentence-split the summary.
  const summarySentences = splitSentences(fitReport.summary);
  const heroLine = summarySentences[0];
  let points =
    fitReport.keyTakeaways.length > 0
      ? fitReport.keyTakeaways
      : summarySentences;
  if (fitReport.keyTakeaways.length === 0 && heroLine && points[0] === heroLine) {
    points = points.slice(1);
  }
  points = points.slice(0, 5);

  const drivers = computeDrivers(metrics);

  const heroStyle = { ["--v" as string]: v.tone } as React.CSSProperties;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {mode === "owner" && (
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/analyses"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All reports
          </Link>
          <ShareReport requestId={meta.requestId} />
        </div>
      )}

      {/* HERO / verdict band */}
      <section
        style={heroStyle}
        className="relative overflow-hidden rounded-2xl border border-default bg-surface shadow-card"
      >
        <span
          className="absolute inset-y-0 left-0 w-1"
          style={{ background: "var(--v)" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, color-mix(in srgb, var(--v) 12%, transparent), transparent 46%)",
          }}
        />
        <div className="relative grid items-center gap-6 p-6 pl-7 sm:grid-cols-[1fr_auto]">
          <div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Party handle={meta.orgHandle} role="Brand" profile={fitReport.profiles?.org} />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                vs
              </span>
              <Party handle={meta.kolHandle} role="Creator" profile={fitReport.profiles?.kol} />
            </div>
            <div
              className="my-2.5 text-[clamp(38px,7vw,56px)] font-bold leading-none tracking-tight"
              style={{ color: "var(--v)" }}
            >
              {v.word}
            </div>
            {heroLine && (
              <p className="max-w-[46ch] text-[15px] text-secondary-foreground">
                {heroLine}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ConfidenceChip level={confidence} />
            </div>
          </div>
          <ScoreGauge value={overall.value} color={v.tone} />
        </div>
        <DriverStrip pos={drivers.pos} neg={drivers.neg} />
      </section>

      {/* KEY TAKEAWAYS */}
      {points.length > 0 && (
        <Panel title="Key takeaways">
          <ul className="grid gap-3">
            {points.map((p, i) => (
              <li key={i} className="grid grid-cols-[20px_1fr] items-start gap-3">
                <span
                  className="mt-1.5 h-2 w-2 rounded-full"
                  style={{ background: v.tone }}
                />
                <span className="text-secondary-foreground">{p}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* AUDIENCE */}
      {(fitReport.audienceMatch ||
        fitReport.audienceBreakdown ||
        fitReport.expectedReach ||
        fitReport.audienceRegions) && (
        <Panel title="Engaged audience: who actually listens">
          {fitReport.targeting && (
            <MatchedAgainst targeting={fitReport.targeting} />
          )}
          {fitReport.audienceBreakdown && (
            <>
              <AudienceDonut distribution={fitReport.audienceBreakdown} />
              {/* The two rings answer different questions over the same people,
                  so shares are NOT meant to line up across them — say so, or a
                  reader tries to reconcile "40% developers" with "30% AI" and
                  concludes one of them is wrong. */}
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                Both rings cover the same accounts, read two different ways —
                what they&rsquo;re into, and what they do. &ldquo;Other&rdquo;
                groups the smaller segments; hover any slice for its breakdown.
              </p>
            </>
          )}
          <div className="mt-4 grid gap-4 border-t border-default pt-4 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-6">
            <div className="flex gap-6">
              {metrics.engaged_audience_match && (
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Audience match
                  </div>
                  <div
                    className="font-mono text-[22px] font-semibold"
                    style={{ color: metrics.engaged_audience_match.value >= 45 ? "var(--state-success)" : "var(--state-error)" }}
                  >
                    {metrics.engaged_audience_match.value}
                  </div>
                </div>
              )}
              {metrics.audience_quality && (
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Audience quality
                  </div>
                  <div
                    className="font-mono text-[22px] font-semibold"
                    style={{ color: metrics.audience_quality.value >= 65 ? "var(--state-success)" : metrics.audience_quality.value >= 45 ? "var(--state-warning)" : "var(--state-error)" }}
                  >
                    {metrics.audience_quality.value}
                  </div>
                </div>
              )}
            </div>
            {fitReport.audienceMatch && (
              <p className="text-[13.5px] text-secondary-foreground">
                {fitReport.audienceMatch.summary}
              </p>
            )}
          </div>
          {/* Dials (Unit 41 v3): how MANY + where — shown beside the fit,
              never blended into it. */}
          {(fitReport.expectedReach ||
            (fitReport.audienceRegions?.placed ?? 0) > 0) && (
            <div className="mt-4 grid gap-4 border-t border-default pt-4 sm:grid-cols-2">
              {fitReport.expectedReach && (
                <ExpectedReachCard reach={fitReport.expectedReach} />
              )}
              {fitReport.audienceRegions && (
                <AudienceGeography regions={fitReport.audienceRegions} />
              )}
            </div>
          )}
        </Panel>
      )}

      {/* SCORE BREAKDOWN */}
      <Panel title="Score breakdown">
        {!scores && (
          <p className="mb-3 text-xs text-muted-foreground">
            Full breakdown unavailable; showing metrics embedded in the report.
          </p>
        )}
        <MetricGroups metrics={metrics} />
      </Panel>

      {/* RECOMMENDATION */}
      {(fitReport.recommendedAngle || fitReport.bestUseCases.length > 0) && (
        <section className="relative overflow-hidden rounded-2xl border border-accent-primary/30 bg-surface p-5 shadow-card sm:p-6">
          <span className="absolute inset-y-0 left-0 w-1 bg-accent-primary" />
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Recommended angle
            </h2>
            <span className="h-px flex-1 bg-gradient-to-r from-default to-transparent" />
          </div>
          {fitReport.recommendedAngle && (
            <p className="text-sm text-secondary-foreground">
              {fitReport.recommendedAngle}
            </p>
          )}
          {fitReport.bestUseCases.length > 0 && (
            <div className="mt-4">
              <Chips items={fitReport.bestUseCases} />
            </div>
          )}
        </section>
      )}

      {/* CONTENT & ENGAGEMENT */}
      {(fitReport.contentAnalysis || fitReport.engagementQuality) && (
        <Panel title="Content & engagement">
          <div className="grid gap-5 sm:grid-cols-2">
            {fitReport.contentAnalysis && (
              <div>
                <h3 className="mb-2 text-[13px] font-semibold text-foreground">
                  Content
                </h3>
                <div className="mb-2.5">
                  <Chips
                    items={[
                      ...fitReport.contentAnalysis.classification.themes,
                      ...fitReport.contentAnalysis.classification.verticals,
                    ]}
                  />
                </div>
                <p className="text-[13.5px] text-secondary-foreground">
                  {fitReport.contentAnalysis.narrative}
                </p>
              </div>
            )}
            {fitReport.engagementQuality && (
              <div>
                <h3 className="mb-2 text-[13px] font-semibold text-foreground">
                  Engagement quality
                </h3>
                <p className="text-[13.5px] text-secondary-foreground">
                  {fitReport.engagementQuality.narrative}
                </p>
                {fitReport.engagementQuality.signals.length > 0 && (
                  <ul className="mt-2.5 grid gap-1.5">
                    {fitReport.engagementQuality.signals.map((s, i) => (
                      <li
                        key={i}
                        className="grid grid-cols-[14px_1fr] gap-2 text-[12.5px] text-muted-foreground"
                      >
                        <span>›</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* RISK & SAFETY */}
      {(fitReport.paidPromo || fitReport.botFarmRisk || fitReport.brandSafety) && (
        <Panel title="Risk & safety">
          <div className="grid gap-3.5">
            {fitReport.paidPromo && metrics.paid_promo_risk && (
              <RiskCard
                title="Paid-promo risk"
                score={metrics.paid_promo_risk.value}
                isRisk
                narrative={fitReport.paidPromo.narrative}
              />
            )}
            {fitReport.botFarmRisk && metrics.bot_farm_risk && (
              <RiskCard
                title="Bot / farm risk"
                score={metrics.bot_farm_risk.value}
                isRisk
                narrative={fitReport.botFarmRisk.narrative}
              />
            )}
            {fitReport.brandSafety && metrics.brand_safety && (
              <RiskCard
                title="Brand safety"
                score={metrics.brand_safety.value}
                narrative={fitReport.brandSafety.narrative}
              />
            )}
          </div>
        </Panel>
      )}

      {/* Concierge CTA (Unit 35): the hands-on tier. Placed after the report
          body, not before it — the on-page report IS the full report (Unit
          36.1), so the offer lands once the reader has the verdict, the scores,
          and the deep-dive rather than interrupting on the way in. */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Want the analyst&apos;s cut of this report?
          </p>
          <p className="mt-0.5 text-xs text-secondary-foreground">
            A hand-curated deep dive on @{meta.kolHandle}, delivered to your
            Telegram within a day.
          </p>
        </div>
        <a
          href={`/detailed?org=${encodeURIComponent(meta.orgHandle)}&kol=${encodeURIComponent(meta.kolHandle)}&analysis=${encodeURIComponent(meta.requestId)}`}
          className="inline-flex shrink-0 items-center rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Request curated report
        </a>
      </section>

      {/* FOOTER — confidence + timestamp only. Sample sizes and evidence
          notes (providers, models, methodology) stay internal (Unit 33). */}
      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Overall confidence:</span>
          <ConfidenceChip level={confidence} />
          {meta.generatedAt && (
            <span className="ml-auto text-[11.5px] text-muted-foreground">
              Generated {new Date(meta.generatedAt).toLocaleString()}
            </span>
          )}
        </div>
      </Panel>
    </div>
  );
}

function RiskCard({
  title,
  score,
  narrative,
  isRisk,
}: {
  title: string;
  score: number;
  narrative: string;
  isRisk?: boolean;
}) {
  const color = isRisk
    ? score >= 60
      ? "var(--state-error)"
      : score >= 35
        ? "var(--state-warning)"
        : "var(--state-success)"
    : score >= 65
      ? "var(--state-success)"
      : score >= 45
        ? "var(--state-warning)"
        : "var(--state-error)";
  return (
    <div
      className="rounded-xl border border-default bg-elevated p-4"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
          <span style={{ color }}>◆</span> {title}
        </div>
        <div className="text-right leading-tight">
          <div className="font-mono text-[15px] font-semibold" style={{ color }}>
            {score} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
          </div>
          {/* A green "9" (low risk) and a green "100" (high safety) both mean
              "good" for opposite reasons — the direction label is what keeps
              the two from reading as inconsistent. */}
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {isRisk ? "Lower is better" : "Higher is better"}
          </div>
        </div>
      </div>
      <p className="text-[13px] text-secondary-foreground">{narrative}</p>
    </div>
  );
}
