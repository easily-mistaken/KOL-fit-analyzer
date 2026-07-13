import {
  err,
  ok,
  FitReportSchema,
  ScoreBreakdownSchema,
  type ApiResponse,
} from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

import { isAdminRequest } from "@/lib/admin/auth";
import type { AnalysisStatusResponse } from "@/lib/analysis-status";
import { getOwnerId } from "@/lib/owner";

// Prisma requires the Node.js runtime; status must never be cached/prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(
  body: ApiResponse<AnalysisStatusResponse>,
  status: number
): Response {
  return Response.json(body, { status });
}

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null;

/**
 * GET /api/analyses/[id]
 *
 * Read-only status/report lookup by AnalysisRequest id. Returns saved DB state
 * only — no writes, no scoring, no provider logic.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  try {
    const request = await prisma.analysisRequest.findUnique({
      where: { id },
      include: { job: true, report: true },
    });

    if (!request || !request.job) {
      return json(err("not_found", "Analysis not found."), 404);
    }

    // Owner scoping (Unit 25): only the browser that created it may view it.
    // 404 (not 403) so a non-owner can't even confirm the analysis exists.
    // Unit 27: a valid admin session bypasses owner scoping — the operator can
    // open any report from the admin panel.
    const ownerId = await getOwnerId();
    const isOwner = Boolean(request.ownerId) && request.ownerId === ownerId;
    if (!isOwner && !(await isAdminRequest())) {
      return json(err("not_found", "Analysis not found."), 404);
    }

    const { job, report } = request;

    // The report/scores JSON was validated on write; re-validate defensively
    // and degrade to null rather than trust a malformed row.
    let fitReport = null;
    if (report?.report != null) {
      const parsed = FitReportSchema.safeParse(report.report);
      fitReport = parsed.success ? parsed.data : null;
    }

    let scores = null;
    if (report?.scores != null) {
      const parsed = ScoreBreakdownSchema.safeParse(report.scores);
      scores = parsed.success ? parsed.data : null;
    }

    const dto: AnalysisStatusResponse = {
      id: request.id,
      orgHandle: request.orgHandle,
      kolHandle: request.kolHandle,
      createdAt: request.createdAt.toISOString(),
      job: {
        status: job.status,
        attempts: job.attempts,
        startedAt: iso(job.startedAt),
        completedAt: iso(job.completedAt),
        failedAt: iso(job.failedAt),
        errorCode: job.errorCode,
        errorMessage: job.errorMessage,
      },
      report: report
        ? {
            status: report.status,
            verdict: report.verdict,
            overallScore: report.overallScore,
            generatedAt: iso(report.generatedAt),
            fitReport,
            scores,
          }
        : null,
    };

    return json(ok(dto), 200);
  } catch (error) {
    console.error(`[GET /api/analyses/${id}] failed to load status:`, error);
    return json(err("internal_error", "Failed to load analysis status."), 500);
  }
}
