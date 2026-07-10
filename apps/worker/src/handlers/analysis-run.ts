import {
  resolveCaps,
  runAnalysis,
  type AnalysisRequestData,
} from "@kol-fit/analysis";
import { Prisma, prisma } from "@kol-fit/db";
import { AnalysisRunPayloadSchema } from "@kol-fit/queue";

import { buildProviders, logProviderUsage } from "../providers.js";
import { classifyAnalysisError } from "../errors.js";

/**
 * Processes one `analysis.run` job: validates the payload, loads the job +
 * request, drives QUEUED -> RUNNING -> COMPLETED/FAILED, runs the analysis
 * pipeline (@kol-fit/analysis), and upserts the resulting Report. Errors are
 * recorded on the AnalysisJob and swallowed (the job is ack'd) so one failure
 * does not sink the pg-boss batch.
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
    // QUEUED -> RUNNING (increment attempts as retry metadata)
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    // Run the mock analysis pipeline. Report-building lives entirely in
    // @kol-fit/analysis; the worker only persists the validated result.
    const requestData: AnalysisRequestData = {
      orgHandle: job.request.orgHandle,
      kolHandle: job.request.kolHandle,
      websiteUrl: job.request.websiteUrl,
      docsUrl: job.request.docsUrl,
      productCategory: job.request.productCategory,
      targetUser: job.request.targetUser,
      campaignGoal: job.request.campaignGoal,
      stage: job.request.stage,
      region: job.request.region,
    };
    // Build cached Twitter provider + LLM provider (caching/usage logging live
    // worker-side; the pipeline stays pure). Caps honor ANALYSIS_* env overrides.
    const { twitter, llm } = buildProviders();
    const caps = resolveCaps();
    const { report, scores, evidence, llmModel } = await runAnalysis(
      requestData,
      { twitter, llm, caps }
    );

    const asJson = (v: unknown) => v as unknown as Prisma.InputJsonValue;
    const reportFields = {
      status: "COMPLETED" as const,
      overallScore: report.overallScore.value,
      verdict: report.verdict,
      scores: asJson(scores),
      report: asJson(report),
      audienceSummary: asJson(evidence.audienceDistribution),
      confidence: { level: report.confidence },
      sampleSize: asJson({
        kolPosts: evidence.kolPostsSampled,
        kolReplies: evidence.kolRepliesSampled,
        topPostsAnalyzed: evidence.topPostsAnalyzed,
        engagedAccounts: evidence.engagedAccountsSampled,
        websiteStatus: evidence.websiteStatus,
        docsStatus: evidence.docsStatus,
      }),
      reportSchemaVersion: report.schemaVersion,
      llmModel,
      promptVersion: null,
      generatedAt: new Date(),
    };

    // Duplicate prevention: Report.requestId is unique, so upsert reuses the
    // single row on retry/double-processing instead of creating a duplicate.
    const savedReport = await prisma.report.upsert({
      where: { requestId },
      create: {
        requestId,
        workspaceId: job.request.workspaceId,
        ...reportFields,
      },
      update: reportFields,
    });

    // Record provider usage (best-effort; mock providers report nothing).
    await logProviderUsage({
      requestId,
      reportId: savedReport.id,
      workspaceId: job.request.workspaceId,
      twitter,
      llm,
    });

    // RUNNING -> COMPLETED
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    console.log(
      `[worker] analysis.run completed for request ${requestId} (report saved).`
    );
  } catch (error) {
    // Map to a stable, user-facing code + safe message (never raw provider/
    // exception text, keys, or PII). Log only the code + a bounded message.
    const { code, message } = classifyAnalysisError(error);
    console.error(
      `[worker] processing failed for request ${requestId} (job ${jobId}): ${code}:`,
      error instanceof Error ? error.message : String(error)
    );
    try {
      // RUNNING -> FAILED
      await prisma.analysisJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorCode: code,
          errorMessage: message,
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
