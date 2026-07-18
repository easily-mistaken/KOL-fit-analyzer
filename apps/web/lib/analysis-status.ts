import type {
  AnalysisProgress,
  FitReport,
  JobStatus,
  ReportStatus,
  ReportVerdict,
  ScoreBreakdown,
} from "@kol-fit/shared";

// Payload returned by GET /api/analyses/[id]. Defined once here and imported by
// both the route handler and the client status component so the shape cannot
// drift. Type-only (the report JSON was already validated on write in Unit 07).
export type AnalysisStatusResponse = {
  id: string;
  orgHandle: string;
  kolHandle: string;
  createdAt: string; // ISO
  job: {
    status: JobStatus;
    attempts: number;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    errorCode: string | null;
    errorMessage: string | null;
  };
  // Live in-flight progress (the waiting screen). Null until the worker writes
  // its first real stage delta, and irrelevant once COMPLETED/FAILED.
  progress: AnalysisProgress | null;
  report: {
    status: ReportStatus;
    verdict: ReportVerdict | null;
    overallScore: number | null;
    generatedAt: string | null;
    fitReport: FitReport | null; // Report.report JSON
    scores: ScoreBreakdown | null; // Report.scores JSON (full 9-metric breakdown)
  } | null;
};
