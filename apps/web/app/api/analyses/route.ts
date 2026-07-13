import {
  AnalysisRequestInputSchema,
  err,
  ok,
  type ApiResponse,
  type JobStatus,
} from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";
import { enqueueAnalysisRun } from "@kol-fit/queue";

import {
  clampLimit,
  listAnalyses,
  type AnalysisListResponse,
} from "@/lib/analyses-list";
import { ensureOwnerId, getOwnerId } from "@/lib/owner";

// Prisma + the pg driver adapter require the Node.js runtime (not Edge).
export const runtime = "nodejs";
// The list reflects live job state as it changes; never cache/prerender it.
export const dynamic = "force-dynamic";

/**
 * GET /api/analyses
 *
 * Read-only, paginated list of saved analyses (newest first). Returns summary
 * columns only — never the heavy report JSON. `?limit` (1..100, default 25) and
 * `?cursor` (an AnalysisRequest.id) drive cursor pagination. Pagination noise is
 * clamped/ignored rather than rejected.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const cursor = url.searchParams.get("cursor") || undefined;

  try {
    const ownerId = await getOwnerId();
    const data = await listAnalyses({ limit, cursor, ownerId });
    return Response.json(ok(data) as ApiResponse<AnalysisListResponse>, {
      status: 200,
    });
  } catch (error) {
    console.error("[GET /api/analyses] failed to list analyses:", error);
    return Response.json(
      err("internal_error", "Failed to load analyses.") as ApiResponse<AnalysisListResponse>,
      { status: 500 }
    );
  }
}

type AnalysisCreated = {
  id: string;
  jobId: string;
  status: JobStatus;
  createdAt: string;
};

function json(body: ApiResponse<AnalysisCreated>, status: number): Response {
  return Response.json(body, { status });
}

// Flattens Zod issues into a single concise, human-readable message.
// We never return the raw Zod error object.
function formatIssues(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): string {
  return error.issues
    .map((issue) => {
      const field = issue.path.join(".") || "body";
      return `${field}: ${issue.message}`;
    })
    .join("; ");
}

/**
 * POST /api/analyses
 *
 * Creates one analysis: validates the input, persists an AnalysisRequest plus
 * its AnalysisJob (QUEUED) in a single atomic write, then enqueues the
 * `analysis.run` pg-boss job and records its id on AnalysisJob.pgBossJobId. It
 * does not run analysis or create a report (Unit 07).
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(err("validation_error", "Invalid JSON body"), 400);
  }

  const parsed = AnalysisRequestInputSchema.safeParse(body);
  if (!parsed.success) {
    return json(err("validation_error", formatIssues(parsed.error)), 400);
  }
  const input = parsed.data;

  try {
    // Tag the analysis with the browser's anonymous owner (sets the cookie on
    // first submit), so it can be scoped to them later.
    const ownerId = await ensureOwnerId();

    const created = await prisma.analysisRequest.create({
      data: {
        ownerId,
        orgHandle: input.orgHandle,
        kolHandle: input.kolHandle,
        websiteUrl: input.websiteUrl ?? null,
        docsUrl: input.docsUrl ?? null,
        productCategory: input.productCategory ?? null,
        targetUser: input.targetUser ?? null,
        campaignGoal: input.campaignGoal ?? null,
        stage: input.stage ?? null,
        region: input.region ?? null,
        // workspaceId omitted -> null (single internal workspace; null = default)
        job: { create: {} }, // AnalysisJob.status defaults to QUEUED
      },
      include: { job: true },
    });

    // job is always present (created above), but the generated relation type is
    // nullable; guard defensively rather than assert.
    if (!created.job) {
      throw new Error("AnalysisJob was not created");
    }
    const jobId = created.job.id;

    // Records are committed; now enqueue the background job.
    let pgBossJobId: string;
    try {
      pgBossJobId = await enqueueAnalysisRun({ requestId: created.id, jobId });
    } catch (enqueueError) {
      console.error("[POST /api/analyses] enqueue failed:", enqueueError);
      // Mark the job FAILED so it is not a silent orphaned QUEUED job.
      try {
        await prisma.analysisJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            errorCode: "enqueue_failed",
            failedAt: new Date(),
          },
        });
      } catch (markError) {
        console.error(
          "[POST /api/analyses] failed to mark job FAILED after enqueue failure:",
          markError
        );
      }
      return json(
        err("internal_error", "Failed to enqueue the analysis job."),
        500
      );
    }

    // Best-effort: store the pg-boss job id. The job is already enqueued and
    // will run, so a failure here is non-fatal (the id is only a debug link).
    try {
      await prisma.analysisJob.update({
        where: { id: jobId },
        data: { pgBossJobId },
      });
    } catch (updateError) {
      console.error(
        "[POST /api/analyses] failed to store pgBossJobId (job still enqueued):",
        updateError
      );
    }

    return json(
      ok({
        id: created.id,
        jobId,
        status: created.job.status,
        createdAt: created.createdAt.toISOString(),
      }),
      201
    );
  } catch (error) {
    // Never leak DB/driver errors, stack traces, or secrets to the client.
    console.error("[POST /api/analyses] failed to create analysis:", error);
    return json(
      err("internal_error", "Failed to create the analysis request."),
      500
    );
  }
}
