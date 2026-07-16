import * as React from "react";
import type { ScoreMetric, ScoreValue } from "@kol-fit/shared";

import { METRIC_INFO } from "@/lib/metric-info";
import { InfoHint } from "@/components/ui/info-hint";

export type MetricMap = Partial<Record<ScoreMetric, ScoreValue>>;

// Fit components (overall_fit is shown as the hero gauge, not here). Display
// order = importance; the numeric weights are internal (Unit 33).
const FIT_METRICS: ScoreMetric[] = [
  "engaged_audience_match",
  "audience_quality",
  "content_fit",
  "campaign_goal_fit",
  "brand_safety",
  "geo_language_fit",
];
const RISK_METRICS: ScoreMetric[] = ["paid_promo_risk", "bot_farm_risk"];

function fitColor(v: number): string {
  return v >= 65 ? "var(--state-success)" : v >= 45 ? "var(--state-warning)" : "var(--state-error)";
}
function riskColor(v: number): string {
  return v >= 60 ? "var(--state-error)" : v >= 35 ? "var(--state-warning)" : "var(--state-success)";
}

function MetricRow({
  metric,
  score,
  isRisk,
}: {
  metric: ScoreMetric;
  score: ScoreValue;
  isRisk?: boolean;
}) {
  const info = METRIC_INFO[metric];
  const color = isRisk ? riskColor(score.value) : fitColor(score.value);
  return (
    <div className="grid grid-cols-[minmax(150px,210px)_1fr_44px] items-center gap-3.5 border-t border-default/60 py-2.5 first:border-t-0">
      <div className="flex items-center gap-2 text-[13.5px] text-foreground">
        <span>{info.label}</span>
        <InfoHint title={info.label} body={[info.what, info.read]} />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-inset">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(2, score.value)}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-right font-mono text-sm font-semibold" style={{ color }}>
        {score.value}
      </div>
    </div>
  );
}

export function MetricGroups({ metrics }: { metrics: MetricMap }) {
  const fit = FIT_METRICS.filter((metric) => metrics[metric]);
  const risk = RISK_METRICS.filter((m) => metrics[m]);

  return (
    <div className="space-y-6">
      {fit.length > 0 && (
        <div>
          <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Fit metrics
          </div>
          <div>
            {fit.map((metric) => (
              <MetricRow key={metric} metric={metric} score={metrics[metric]!} />
            ))}
          </div>
        </div>
      )}
      {risk.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Risk metrics
            <span className="normal-case tracking-normal text-warning">
              — higher is worse
            </span>
          </div>
          <div>
            {risk.map((metric) => (
              <MetricRow
                key={metric}
                metric={metric}
                score={metrics[metric]!}
                isRisk
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
