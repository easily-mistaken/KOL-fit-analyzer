import { NextResponse } from "next/server";

import { err, ok, type ApiResponse } from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";
import { enqueueAnalysisRun } from "@kol-fit/queue";

import { isAdminRequest } from "@/lib/admin/auth";
import { getOwnerId } from "@/lib/owner";
import { checkAnalysisRateLimit } from "@/lib/rate-limit";

// Manual retry for FAILED analyses (Unit 40). Human-initiated complement to
// the worker's auto-retry for transient errors. Near-free thanks to the
// provider caches; still subject to the daily abuse caps (a retry re-spends).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOTAL_ATTEMPTS = 10;

function json<T>(body: ApiResponse<T>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const request = await prisma.analysisRequest.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!request || !request.job) {
      return json(err("not_found", "Analysis not found."), 404);
    }
    const ownerId = await getOwnerId();
    const isOwner = Boolean(request.ownerId) && request.ownerId === ownerId;
    if (!isOwner && !(await isAdminRequest())) {
      return json(err("not_found", "Analysis not found."), 404);
    }

    if (request.job.status !== "FAILED") {
      return json(err("conflict", "Only failed analyses can be retried."), 409);
    }
    if (request.job.attempts >= MAX_TOTAL_ATTEMPTS) {
      return json(
        err("rate_limited", "This analysis has been retried too many times."),
        429
      );
    }
    // Daily abuse caps still apply — a retry re-spends provider calls.
    if (request.ownerId) {
      const decision = await checkAnalysisRateLimit(request.ownerId);
      if (!decision.allowed) {
        return json(err("rate_limited", decision.message), 429);
      }
    }

    await prisma.analysisJob.update({
      where: { id: request.job.id },
      data: {
        status: "QUEUED",
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        failedAt: null,
      },
    });

    try {
      const pgBossJobId = await enqueueAnalysisRun({
        requestId: request.id,
        jobId: request.job.id,
      });
      // Best-effort bookkeeping (mirrors the create route).
      await prisma.analysisJob
        .update({ where: { id: request.job.id }, data: { pgBossJobId } })
        .catch(() => {});
    } catch {
      // Enqueue failed — revert so the job doesn't sit QUEUED forever.
      await prisma.analysisJob
        .update({
          where: { id: request.job.id },
          data: {
            status: "FAILED",
            errorCode: "enqueue_failed",
            errorMessage: "Could not re-queue the analysis. Please try again.",
            failedAt: new Date(),
          },
        })
        .catch(() => {});
      return json(err("internal_error", "Could not re-queue the analysis."), 500);
    }

    return json(ok({ id: request.id, status: "QUEUED" }), 200);
  } catch {
    return json(err("internal_error", "Could not retry the analysis."), 500);
  }
}
