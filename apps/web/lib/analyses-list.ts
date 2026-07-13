import { prisma } from "@kol-fit/db";
import type { JobStatus, ReportStatus, ReportVerdict } from "@kol-fit/shared";

// One row in the saved-reports list (Unit 20). Summary only — never the heavy
// Report.report / Report.scores JSON. Defined once and shared by the GET route
// and the /analyses server component so the shape cannot drift.
export type AnalysisListItem = {
  id: string; // AnalysisRequest.id — the report link target
  orgHandle: string;
  kolHandle: string;
  createdAt: string; // ISO
  jobStatus: JobStatus | null; // live job state (null if no job row)
  report: {
    status: ReportStatus;
    verdict: ReportVerdict | null;
    overallScore: number | null; // 0..100
    generatedAt: string | null; // ISO
  } | null; // null until the worker writes a Report
};

export type AnalysisListResponse = {
  items: AnalysisListItem[];
  nextCursor: string | null; // AnalysisRequest.id to pass as ?cursor; null = end
};

export const DEFAULT_LIST_LIMIT = 25;
export const MAX_LIST_LIMIT = 100;

/** Clamps an untrusted limit into [1, MAX_LIST_LIMIT], falling back to default. */
export function clampLimit(raw: unknown): number {
  const n =
    typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.trunc(n), MAX_LIST_LIMIT);
}

/**
 * Lists analyses newest-first with cursor pagination. Reads saved DB state only
 * (no scoring, no provider calls) and selects summary columns only. `cursor` is
 * an AnalysisRequest.id from a previous page's `nextCursor`.
 */
export async function listAnalyses({
  limit = DEFAULT_LIST_LIMIT,
  cursor,
  ownerId,
}: {
  limit?: number;
  cursor?: string | null;
  ownerId?: string | null;
} = {}): Promise<AnalysisListResponse> {
  // Scoped to the owner (Unit 25). No owner → owns nothing → empty list.
  if (!ownerId) return { items: [], nextCursor: null };
  const take = Math.min(Math.max(1, Math.trunc(limit)), MAX_LIST_LIMIT);

  const rows = await prisma.analysisRequest.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    take: take + 1, // +1 sentinel to detect a next page
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      orgHandle: true,
      kolHandle: true,
      createdAt: true,
      job: { select: { status: true } },
      report: {
        select: {
          status: true,
          verdict: true,
          overallScore: true,
          generatedAt: true,
        },
      },
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  const items: AnalysisListItem[] = page.map((r) => ({
    id: r.id,
    orgHandle: r.orgHandle,
    kolHandle: r.kolHandle,
    createdAt: r.createdAt.toISOString(),
    jobStatus: r.job?.status ?? null,
    report: r.report
      ? {
          status: r.report.status,
          verdict: r.report.verdict,
          overallScore: r.report.overallScore,
          generatedAt: r.report.generatedAt
            ? r.report.generatedAt.toISOString()
            : null,
        }
      : null,
  }));

  return {
    items,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}
