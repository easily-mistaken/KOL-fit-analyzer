import * as React from "react";
import type { ScoreMetric, ScoreValue } from "@kol-fit/shared";

import { ScoreMeter } from "@/components/report/score-meter";

// UI-only display labels (no shared change needed).
const SCORE_METRIC_LABELS: Record<ScoreMetric, string> = {
  overall_fit: "Overall fit",
  engaged_audience_match: "Engaged audience match",
  audience_quality: "Audience quality",
  content_fit: "Content fit",
  campaign_goal_fit: "Campaign goal fit",
  brand_safety: "Brand safety",
  geo_language_fit: "Geo / language fit",
  paid_promo_risk: "Paid promo risk",
  bot_farm_risk: "Bot / farm risk",
};

const RISK_METRICS = new Set<ScoreMetric>(["paid_promo_risk", "bot_farm_risk"]);

// Display order: overall + fit metrics first, then the two risk metrics.
const FIT_ORDER: ScoreMetric[] = [
  "overall_fit",
  "engaged_audience_match",
  "audience_quality",
  "content_fit",
  "campaign_goal_fit",
  "brand_safety",
  "geo_language_fit",
];
const RISK_ORDER: ScoreMetric[] = ["paid_promo_risk", "bot_farm_risk"];

export type MetricMap = Partial<Record<ScoreMetric, ScoreValue>>;

function MetricCell({ metric, score }: { metric: ScoreMetric; score?: ScoreValue }) {
  const label = SCORE_METRIC_LABELS[metric];
  if (!score) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-foreground">{label}</span>
          <span className="font-mono text-sm text-muted-foreground">—</span>
        </div>
        <p className="text-xs text-muted-foreground">Not scored / unavailable.</p>
      </div>
    );
  }
  return (
    <ScoreMeter
      label={label}
      score={score}
      kind={RISK_METRICS.has(metric) ? "risk" : "fit"}
    />
  );
}

/** All 9 score metrics at a glance, fit metrics then risk metrics. */
export function ScoreMatrix({ metrics }: { metrics: MetricMap }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {FIT_ORDER.map((m) => (
          <MetricCell key={m} metric={m} score={metrics[m]} />
        ))}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          Risk metrics — higher = worse
        </p>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {RISK_ORDER.map((m) => (
            <MetricCell key={m} metric={m} score={metrics[m]} />
          ))}
        </div>
      </div>
    </div>
  );
}
