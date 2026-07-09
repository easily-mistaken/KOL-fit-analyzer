import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type {
  FitReport,
  ReportVerdict,
  ScoreBreakdown,
  ScoreMetric,
  ScoreValue,
} from "@kol-fit/shared";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AudienceBars } from "@/components/report/audience-bars";
import { ConfidenceChip, ScoreMeter } from "@/components/report/score-meter";
import { ScoreMatrix, type MetricMap } from "@/components/report/score-matrix";
import {
  BulletList,
  ChipRow,
  ReportSection,
} from "@/components/report/report-section";

const VERDICT_TONE: Record<ReportVerdict, string> = {
  STRONG: "border-success/40 text-success",
  GOOD: "border-success/40 text-success",
  OKAY: "border-warning/40 text-warning",
  WEAK: "border-error/40 text-error",
  AVOID: "border-error/40 text-error",
};

const SAMPLE_LABELS: Record<string, string> = {
  kolPosts: "KOL posts",
  kolReplies: "KOL replies",
  topPostsAnalyzed: "Top posts analyzed",
  engagedAccounts: "Engaged accounts",
  websiteChars: "Website chars",
  docsChars: "Docs chars",
};

function humanizeKey(key: string): string {
  return (
    SAMPLE_LABELS[key] ??
    key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())
  );
}

// Merge the full ScoreBreakdown (authoritative) with the 6 metrics embedded in
// the FitReport (fallback when scores is null). No recomputation — just picks
// saved ScoreValues.
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

export function FitReportView({
  fitReport,
  scores,
  meta,
}: {
  fitReport: FitReport;
  scores: ScoreBreakdown | null;
  meta: {
    orgHandle: string;
    kolHandle: string;
    requestId: string;
    generatedAt: string | null;
  };
}) {
  const metrics = collectMetrics(fitReport, scores);
  const overall = scores?.overall ?? fitReport.overallScore;
  const confidence = scores?.confidence ?? fitReport.confidence;
  const verdict = fitReport.verdict;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        New analysis
      </Link>

      {/* Hero */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base text-foreground">
                @{meta.orgHandle}{" "}
                <span className="text-muted-foreground">vs</span> @{meta.kolHandle}
              </CardTitle>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {meta.requestId}
              </p>
            </div>
            <Badge
              variant="outline"
              className="shrink-0 gap-1.5 border-success/40 text-success"
            >
              <CheckCircle2 className="h-4 w-4" />
              Completed
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Verdict</p>
              <Badge
                variant="outline"
                className={cn("text-sm", VERDICT_TONE[verdict])}
              >
                {verdict}
              </Badge>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-xs text-muted-foreground">Overall fit</p>
              <p className="font-mono text-3xl font-semibold text-foreground">
                {overall.value}
                <span className="text-base text-muted-foreground"> / 100</span>
              </p>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-accent-hover"
              style={{ width: `${Math.max(0, Math.min(100, overall.value))}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ConfidenceChip level={confidence} />
            {meta.generatedAt && (
              <span className="text-xs text-muted-foreground">
                Generated {new Date(meta.generatedAt).toLocaleString()}
              </span>
            )}
          </div>

          {overall.reasons.length > 0 && (
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {overall.reasons.map((r, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-muted-foreground/60">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Score matrix — all 9 metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-foreground">Score breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {!scores && (
            <p className="mb-3 text-xs text-muted-foreground">
              Full breakdown unavailable; showing metrics embedded in the report.
            </p>
          )}
          <ScoreMatrix metrics={metrics} />
        </CardContent>
      </Card>

      {/* Recommendation */}
      {(fitReport.bestUseCases.length > 0 ||
        fitReport.weakUseCases.length > 0 ||
        fitReport.recommendedAngle) && (
        <Card>
          <CardContent className="space-y-5 pt-6">
            {fitReport.bestUseCases.length > 0 && (
              <ReportSection title="Best use cases">
                <BulletList items={fitReport.bestUseCases} />
              </ReportSection>
            )}
            {fitReport.weakUseCases.length > 0 && (
              <>
                <Separator />
                <ReportSection title="Weak use cases">
                  <BulletList items={fitReport.weakUseCases} />
                </ReportSection>
              </>
            )}
            {fitReport.recommendedAngle && (
              <>
                <Separator />
                <ReportSection title="Recommended campaign angle">
                  <p className="rounded-lg border border-accent/30 bg-elevated px-3 py-2.5 text-sm text-secondary-foreground">
                    {fitReport.recommendedAngle}
                  </p>
                </ReportSection>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audience */}
      {(fitReport.audienceMatch || fitReport.audienceBreakdown) && (
        <Card>
          <CardContent className="space-y-5 pt-6">
            {fitReport.audienceMatch && (
              <ReportSection title="Audience match">
                <p className="text-sm text-secondary-foreground">
                  {fitReport.audienceMatch.summary}
                </p>
                {metrics.engaged_audience_match && (
                  <ScoreMeter
                    label="Engaged audience match"
                    score={metrics.engaged_audience_match}
                    showReasons
                  />
                )}
              </ReportSection>
            )}
            {fitReport.audienceBreakdown && (
              <>
                {fitReport.audienceMatch && <Separator />}
                <ReportSection title="Audience breakdown">
                  <AudienceBars distribution={fitReport.audienceBreakdown} />
                </ReportSection>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Content & engagement */}
      {(fitReport.contentAnalysis || fitReport.engagementQuality) && (
        <Card>
          <CardContent className="space-y-5 pt-6">
            {fitReport.contentAnalysis && (
              <ReportSection title="KOL content analysis">
                <div className="space-y-2">
                  <ChipRow
                    items={[
                      ...fitReport.contentAnalysis.classification.themes,
                      ...fitReport.contentAnalysis.classification.verticals,
                    ]}
                  />
                  <p className="text-sm text-secondary-foreground">
                    {fitReport.contentAnalysis.narrative}
                  </p>
                </div>
              </ReportSection>
            )}
            {fitReport.engagementQuality && (
              <>
                {fitReport.contentAnalysis && <Separator />}
                <ReportSection title="Engagement quality">
                  <p className="text-sm text-secondary-foreground">
                    {fitReport.engagementQuality.narrative}
                  </p>
                  <ChipRow items={fitReport.engagementQuality.signals} />
                </ReportSection>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Risk & safety */}
      {(fitReport.paidPromo ||
        fitReport.botFarmRisk ||
        fitReport.brandSafety ||
        fitReport.geoLanguageFit) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-foreground">
              Risk &amp; safety
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {fitReport.paidPromo && metrics.paid_promo_risk && (
              <ReportSection title="Paid promo detection">
                <p className="text-sm text-secondary-foreground">
                  {fitReport.paidPromo.narrative}
                </p>
                <ScoreMeter
                  label="Paid promo risk"
                  score={metrics.paid_promo_risk}
                  kind="risk"
                  showReasons
                />
              </ReportSection>
            )}
            {fitReport.botFarmRisk && metrics.bot_farm_risk && (
              <>
                <Separator />
                <ReportSection title="Bot / farm risk">
                  <p className="text-sm text-secondary-foreground">
                    {fitReport.botFarmRisk.narrative}
                  </p>
                  <ScoreMeter
                    label="Bot / farm risk"
                    score={metrics.bot_farm_risk}
                    kind="risk"
                    showReasons
                  />
                </ReportSection>
              </>
            )}
            {fitReport.brandSafety && metrics.brand_safety && (
              <>
                <Separator />
                <ReportSection title="Brand safety">
                  <p className="text-sm text-secondary-foreground">
                    {fitReport.brandSafety.narrative}
                  </p>
                  <ScoreMeter
                    label="Brand safety"
                    score={metrics.brand_safety}
                    showReasons
                  />
                </ReportSection>
              </>
            )}
            {fitReport.geoLanguageFit && metrics.geo_language_fit && (
              <>
                <Separator />
                <ReportSection title="Geo / language fit">
                  <p className="text-sm text-secondary-foreground">
                    {fitReport.geoLanguageFit.narrative}
                  </p>
                  <ScoreMeter
                    label="Geo / language fit"
                    score={metrics.geo_language_fit}
                    showReasons
                  />
                </ReportSection>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Evidence & confidence */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-foreground">
            Evidence &amp; sample size
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(fitReport.evidence.sampleSizes).length > 0 && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {Object.entries(fitReport.evidence.sampleSizes).map(([k, v]) => (
                <div key={k} className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">
                    {humanizeKey(k)}
                  </dt>
                  <dd className="font-mono text-sm text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Overall confidence:
            </span>
            <ConfidenceChip level={confidence} />
          </div>
          {fitReport.evidence.notes.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {fitReport.evidence.notes.map((n, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-muted-foreground/60">•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
