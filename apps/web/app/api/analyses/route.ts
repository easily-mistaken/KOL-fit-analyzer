import {
  AnalysisRequestInputSchema,
  err,
  ok,
  type ApiResponse,
  type JobStatus,
} from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

// Prisma + the pg driver adapter require the Node.js runtime (not Edge).
export const runtime = "nodejs";

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
 * Creates one analysis: validates the input, then persists an AnalysisRequest
 * plus its AnalysisJob (QUEUED) in a single atomic write. It does not enqueue
 * anything (Unit 06), run analysis, or create a report (Unit 07).
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
    const created = await prisma.analysisRequest.create({
      data: {
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

    return json(
      ok({
        id: created.id,
        jobId: created.job.id,
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
