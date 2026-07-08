import { Prisma, prisma } from "@kol-fit/db";
import { AnalysisRunPayloadSchema } from "@kol-fit/queue";

import { buildPlaceholderReport } from "../placeholder-report.js";

/**
 * Processes one `analysis.run` job: validates the payload, loads the job +
 * request, drives QUEUED -> RUNNING -> COMPLETED/FAILED, and upserts a
 * placeholder Report. Errors are recorded on the AnalysisJob and swallowed
 * (the job is ack'd) so one failure does not sink the pg-boss batch.
 *
 * @param rawData  the pg-boss job payload (untrusted -> validated here)
 * @param pgJobId  the pg-boss job id (for logging only)
 */
export async function processAnalysisRun(
  rawData: unknown,
  pgJobId: string
): Promise<void> {
  const parsed = AnalysisRunPayloadSchema.safeParse(rawData);
  if (!parsed.success) {
    console.warn(
      `[worker] invalid analysis.run payload (pg-boss job ${pgJobId}); acking.`,
      parsed.error.issues
    );
    return;
  }
  const { requestId, jobId } = parsed.data;

  const job = await prisma.analysisJob.findUnique({
    where: { id: jobId },
    include: { request: true },
  });

  if (!job || !job.request) {
    console.warn(
      `[worker] AnalysisJob ${jobId} (or its request) not found; acking.`
    );
    return;
  }
  if (job.requestId !== requestId) {
    console.warn(
      `[worker] payload requestId ${requestId} != job.requestId ${job.requestId}; acking.`
    );
    return;
  }
  // Idempotency: a retried/redelivered job must not reprocess or duplicate.
  if (job.status === "COMPLETED") {
    console.log(`[worker] AnalysisJob ${jobId} already completed; skipping.`);
    return;
  }

  try {
    // QUEUED -> RUNNING
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    const placeholder = buildPlaceholderReport();
    const reportJson = placeholder as unknown as Prisma.InputJsonValue;
    const reportFields = {
      status: "COMPLETED" as const,
      overallScore: placeholder.overallScore.value,
      verdict: placeholder.verdict,
      report: reportJson,
      confidence: { level: placeholder.confidence },
      reportSchemaVersion: placeholder.schemaVersion,
      generatedAt: new Date(),
    };

    // Duplicate prevention: Report.requestId is unique, so upsert reuses the
    // single row on retry/double-processing instead of creating a duplicate.
    await prisma.report.upsert({
      where: { requestId },
      create: {
        requestId,
        workspaceId: job.request.workspaceId,
        ...reportFields,
      },
      update: reportFields,
    });

    // RUNNING -> COMPLETED
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    console.log(
      `[worker] analysis.run completed for request ${requestId} (placeholder report saved).`
    );
  } catch (error) {
    // Full detail server-side only; never store secrets/stack traces on the job.
    console.error(
      `[worker] processing failed for request ${requestId} (job ${jobId}):`,
      error
    );
    try {
      // RUNNING -> FAILED
      await prisma.analysisJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorCode: "worker_error",
          errorMessage: "Worker failed to process the analysis job.",
        },
      });
    } catch (markError) {
      console.error(
        `[worker] failed to mark job ${jobId} FAILED:`,
        markError
      );
    }
  }
}
