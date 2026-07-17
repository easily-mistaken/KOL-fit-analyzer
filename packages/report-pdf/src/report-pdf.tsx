import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  APP_NAME,
  AUDIENCE_BUCKET_LABELS,
  type AudienceBucket,
  type FitReport,
  type ScoreBreakdown,
  type ScoreMetric,
  type ScoreValue,
} from "@kol-fit/shared";

// Light, printable palette. The brand lime is very light, so on white paper it
// is a FILL colour only (chips, rules) and never text; `brandDeep` is the
// print-safe version used for bars and marks that must survive a mono printer.
const C = {
  ink: "#0a0c10",
  sub: "#4a5057",
  muted: "#8a9099",
  brand: "#bef54b",
  brandDeep: "#6f9e13",
  success: "#1f9d57",
  warning: "#b67611",
  error: "#d6433b",
  border: "#e7e9ec",
  track: "#eef0f3",
  paper: "#ffffff",
};

const s = StyleSheet.create({
  page: { backgroundColor: C.paper, color: C.ink, paddingTop: 42, paddingBottom: 46, paddingHorizontal: 44, fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.5 },
  eyebrow: { fontSize: 8, letterSpacing: 1.4, color: C.muted, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  h1: { fontSize: 17, fontFamily: "Helvetica-Bold", marginTop: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 9, color: C.ink, fontFamily: "Helvetica-Bold", letterSpacing: 0.4 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  brandMark: { width: 6, height: 6, borderRadius: 1, backgroundColor: C.brand },
  rule: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  verdictRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4 },
  verdictWord: { fontSize: 26, fontFamily: "Helvetica-Bold" },
  scoreBig: { fontSize: 30, fontFamily: "Helvetica-Bold" },
  scoreUnit: { fontSize: 11, color: C.muted },
  metaLine: { fontSize: 9, color: C.muted, marginTop: 3 },
  section: { marginTop: 18 },
  secTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  bullet: { flexDirection: "row", marginBottom: 4 },
  bulletDot: { width: 10, color: C.brandDeep, fontFamily: "Helvetica-Bold" },
  bulletText: { flex: 1, color: C.sub },
  metricRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  metricName: { width: 150, fontSize: 9.5 },
  metricWeight: { color: C.muted, fontSize: 8 },
  barTrack: { flex: 1, height: 6, backgroundColor: C.track, borderRadius: 3, marginHorizontal: 8 },
  barFill: { height: 6, borderRadius: 3 },
  metricVal: { width: 26, textAlign: "right", fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  groupLabel: { fontSize: 8, letterSpacing: 1, color: C.muted, textTransform: "uppercase", fontFamily: "Helvetica-Bold", marginBottom: 6, marginTop: 4 },
  audRow: { flexDirection: "row", alignItems: "center", marginBottom: 3.5 },
  audLabel: { width: 150, fontSize: 9.5, color: C.sub },
  audVal: { width: 34, textAlign: "right", fontSize: 9, fontFamily: "Helvetica-Bold" },
  lowTag: { fontSize: 7, color: C.error, fontFamily: "Helvetica-Bold", marginLeft: 4 },
  para: { color: C.sub, marginBottom: 6 },
  subhead: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  callout: { borderLeftWidth: 3, borderLeftColor: C.brand, backgroundColor: "#f8fdec", padding: 10, borderRadius: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  chip: { fontSize: 8, color: C.sub, borderWidth: 1, borderColor: C.border, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 5, marginRight: 4, marginBottom: 4 },
  evidGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  evidCell: { width: "25%", marginBottom: 6 },
  evidKey: { fontSize: 7.5, color: C.muted, textTransform: "uppercase" },
  evidVal: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 22, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6 },
});

const LOW_QUALITY = new Set<AudienceBucket>(["bots_spam", "giveaway_hunters", "airdrop_farmers"]);
const VERDICT: Record<string, { word: string; color: string }> = {
  STRONG: { word: "Strong fit", color: C.success },
  GOOD: { word: "Good fit", color: C.success },
  OKAY: { word: "Okay fit", color: C.warning },
  WEAK: { word: "Weak fit", color: C.error },
  AVOID: { word: "Avoid", color: C.error },
};

const FIT: { metric: ScoreMetric; weight: string }[] = [
  { metric: "engaged_audience_match", weight: "35%" },
  { metric: "audience_quality", weight: "20%" },
  { metric: "content_fit", weight: "15%" },
  { metric: "campaign_goal_fit", weight: "15%" },
  { metric: "brand_safety", weight: "10%" },
  { metric: "geo_language_fit", weight: "5%" },
];
const RISK: ScoreMetric[] = ["paid_promo_risk", "bot_farm_risk"];
const LABEL: Record<ScoreMetric, string> = {
  overall_fit: "Overall fit",
  engaged_audience_match: "Engaged audience match",
  audience_quality: "Audience quality",
  content_fit: "Content fit",
  campaign_goal_fit: "Campaign goal fit",
  brand_safety: "Brand safety",
  geo_language_fit: "Geo / language fit",
  paid_promo_risk: "Paid-promo risk",
  bot_farm_risk: "Bot / farm risk",
};

const fitColor = (v: number) => (v >= 65 ? C.success : v >= 45 ? C.warning : C.error);
const riskColor = (v: number) => (v >= 60 ? C.error : v >= 35 ? C.warning : C.success);

function metricMap(fit: FitReport, scores: ScoreBreakdown | null): Partial<Record<ScoreMetric, ScoreValue>> {
  const m: Partial<Record<ScoreMetric, ScoreValue>> = {};
  if (scores) {
    m.overall_fit = scores.overall;
    Object.assign(m, scores.components);
  }
  const fb: Partial<Record<ScoreMetric, ScoreValue | undefined>> = {
    engaged_audience_match: fit.audienceMatch?.score,
    paid_promo_risk: fit.paidPromo?.riskScore,
    bot_farm_risk: fit.botFarmRisk?.riskScore,
    brand_safety: fit.brandSafety?.score,
    geo_language_fit: fit.geoLanguageFit?.score,
  };
  for (const [k, v] of Object.entries(fb)) {
    const key = k as ScoreMetric;
    if (!m[key] && v) m[key] = v;
  }
  return m;
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <View style={s.barTrack}>
      <View style={[s.barFill, { width: `${Math.max(2, Math.min(100, value))}%`, backgroundColor: color }]} />
    </View>
  );
}

function MetricRows({ metrics }: { metrics: Partial<Record<ScoreMetric, ScoreValue>> }) {
  return (
    <View>
      <Text style={s.groupLabel}>Fit metrics</Text>
      {FIT.filter((f) => metrics[f.metric]).map((f) => {
        const v = metrics[f.metric]!.value;
        return (
          <View style={s.metricRow} key={f.metric}>
            <Text style={s.metricName}>
              {LABEL[f.metric]} <Text style={s.metricWeight}>{f.weight}</Text>
            </Text>
            <Bar value={v} color={fitColor(v)} />
            <Text style={[s.metricVal, { color: fitColor(v) }]}>{v}</Text>
          </View>
        );
      })}
      <Text style={s.groupLabel}>Risk metrics (higher is worse)</Text>
      {RISK.filter((m) => metrics[m]).map((m) => {
        const v = metrics[m]!.value;
        return (
          <View style={s.metricRow} key={m}>
            <Text style={s.metricName}>{LABEL[m]}</Text>
            <Bar value={v} color={riskColor(v)} />
            <Text style={[s.metricVal, { color: riskColor(v) }]}>{v}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ReportDocument({
  fitReport,
  scores,
  meta,
}: {
  fitReport: FitReport;
  scores: ScoreBreakdown | null;
  meta: { orgHandle: string; kolHandle: string; generatedAt: string | null };
}) {
  const metrics = metricMap(fitReport, scores);
  const overall = (scores?.overall ?? fitReport.overallScore).value;
  const v = VERDICT[fitReport.verdict] ?? { word: fitReport.verdict, color: C.ink };
  const takeaways =
    fitReport.keyTakeaways.length > 0
      ? fitReport.keyTakeaways
      : (fitReport.summary ? [fitReport.summary] : []);

  const buckets = fitReport.audienceBreakdown
    ? (Object.entries(fitReport.audienceBreakdown.buckets) as [AudienceBucket, { share: number } | undefined][])
        .filter(([, x]) => (x?.share ?? 0) > 0)
        .sort((a, b) => (b[1]?.share ?? 0) - (a[1]?.share ?? 0))
        .slice(0, 12)
    : [];

  const gen = meta.generatedAt ? new Date(meta.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;

  return (
    <Document title={`${APP_NAME} report: ${meta.orgHandle} x ${meta.kolHandle}`}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.eyebrow}>Engaged-audience fit report</Text>
            <Text style={s.h1}>
              @{meta.orgHandle}  vs  @{meta.kolHandle}
            </Text>
            {gen && <Text style={s.metaLine}>Generated {gen}</Text>}
          </View>
          <View style={s.brandRow}>
            <View style={s.brandMark} />
            <Text style={s.brand}>{APP_NAME}</Text>
          </View>
        </View>

        <View style={s.rule} />

        <View style={s.verdictRow}>
          <View>
            <Text style={s.eyebrow}>Verdict</Text>
            <Text style={[s.verdictWord, { color: v.color }]}>{v.word}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.eyebrow}>Overall fit</Text>
            <Text style={[s.scoreBig, { color: v.color }]}>
              {overall}
              <Text style={s.scoreUnit}> / 100</Text>
            </Text>
          </View>
        </View>

        {takeaways.length > 0 && (
          <View style={s.section}>
            <Text style={s.secTitle}>Key takeaways</Text>
            {takeaways.map((t, i) => (
              <View style={s.bullet} key={i}>
                <Text style={s.bulletDot}>{"•"}</Text>
                <Text style={s.bulletText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.secTitle}>Score breakdown</Text>
          <MetricRows metrics={metrics} />
        </View>

        {buckets.length > 0 && (
          <View style={s.section}>
            <Text style={s.secTitle}>
              Engaged audience {fitReport.audienceBreakdown ? `(${fitReport.audienceBreakdown.sampleSize} classified)` : ""}
            </Text>
            {buckets.map(([bucket, x]) => {
              const low = LOW_QUALITY.has(bucket);
              return (
                <View style={s.audRow} key={bucket}>
                  <Text style={s.audLabel}>
                    {AUDIENCE_BUCKET_LABELS[bucket] ?? bucket}
                    {low ? <Text style={s.lowTag}> low-quality</Text> : ""}
                  </Text>
                  <Bar value={(x?.share ?? 0) * 100} color={low ? C.error : C.brandDeep} />
                  <Text style={s.audVal}>{Math.round((x?.share ?? 0) * 100)}%</Text>
                </View>
              );
            })}
          </View>
        )}

        {fitReport.recommendedAngle && (
          <View style={s.section} wrap={false}>
            <Text style={s.secTitle}>Recommended angle</Text>
            <View style={s.callout}>
              <Text style={{ color: C.sub }}>{fitReport.recommendedAngle}</Text>
            </View>
          </View>
        )}

        {fitReport.contentAnalysis && (
          <View style={s.section} wrap={false}>
            <Text style={s.secTitle}>Content analysis</Text>
            <View style={s.chipRow}>
              {[...fitReport.contentAnalysis.classification.themes, ...fitReport.contentAnalysis.classification.verticals].slice(0, 10).map((t, i) => (
                <Text style={s.chip} key={i}>{t}</Text>
              ))}
            </View>
            <Text style={s.para}>{fitReport.contentAnalysis.narrative}</Text>
          </View>
        )}

        {(fitReport.paidPromo || fitReport.botFarmRisk || fitReport.brandSafety) && (
          <View style={s.section} wrap={false}>
            <Text style={s.secTitle}>Risk & safety</Text>
            {fitReport.paidPromo && (
              <>
                <Text style={s.subhead}>Paid-promo risk</Text>
                <Text style={s.para}>{fitReport.paidPromo.narrative}</Text>
              </>
            )}
            {fitReport.botFarmRisk && (
              <>
                <Text style={s.subhead}>Bot / farm risk</Text>
                <Text style={s.para}>{fitReport.botFarmRisk.narrative}</Text>
              </>
            )}
            {fitReport.brandSafety && (
              <>
                <Text style={s.subhead}>Brand safety</Text>
                <Text style={s.para}>{fitReport.brandSafety.narrative}</Text>
              </>
            )}
          </View>
        )}

        {Object.keys(fitReport.evidence.sampleSizes).length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.secTitle}>Evidence & sample</Text>
            <View style={s.evidGrid}>
              {Object.entries(fitReport.evidence.sampleSizes).map(([k, val]) => (
                <View style={s.evidCell} key={k}>
                  <Text style={s.evidKey}>{k.replace(/([a-z])([A-Z])/g, "$1 $2")}</Text>
                  <Text style={s.evidVal}>{val}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>{APP_NAME}: engaged-audience fit report</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** Renders a fit report to a PDF Buffer. Deterministic; no network. */
export async function renderReportPdf(input: {
  fitReport: FitReport;
  scores: ScoreBreakdown | null;
  meta: { orgHandle: string; kolHandle: string; generatedAt: string | null };
}): Promise<Buffer> {
  return renderToBuffer(
    <ReportDocument fitReport={input.fitReport} scores={input.scores} meta={input.meta} />
  );
}
