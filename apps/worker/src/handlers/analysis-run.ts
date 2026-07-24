import {
  resolveCaps,
  runAnalysis,
  type AnalysisRequestData,
} from "@kol-fit/analysis";
import { Prisma, prisma } from "@kol-fit/db";
import { AnalysisRunPayloadSchema, enqueueAnalysisRun } from "@kol-fit/queue";
import { SCORING_VERSION, type AnalysisProgress } from "@kol-fit/shared";

import { buildProviders, logProviderUsage } from "../providers.js";
import { classifyAnalysisError, decideRetry } from "../errors.js";

// Positive integer parse with a floor: valid finite >= min -> truncated int;
// else the default. Mirrors the env idiom used elsewhere in the repo.
function posIntMin(v: string | undefined, def: number, min: number): number {
  const n = Number(v);
  return Number.isFinite(n) && Math.trunc(n) >= min ? Math.trunc(n) : def;
}

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
    // QUEUED -> RUNNING (increment attempts as retry metadata). Capture the
    // incremented value onto the in-memory job so the retry decision below sees
    // the post-increment count (first run = 1), not the stale loaded value.
    const running = await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        attempts: { increment: 1 },
        progress: Prisma.DbNull, // clear any stale progress from a prior attempt
      },
    });
    job.attempts = running.attempts;

    // Live progress (the waiting screen). The pipeline emits report-safe deltas
    // as it clears real stage boundaries; we merge them into one snapshot and
    // persist it. Best-effort throughout: a progress write must NEVER fail the
    // analysis. Writes are chained so out-of-order updates can't regress the
    // stage, and each write carries the full merged snapshot.
    let progressSnapshot: AnalysisProgress | null = null;
    let progressWrites: Promise<unknown> = Promise.resolve();
    const persistProgress = (delta: AnalysisProgress): void => {
      progressSnapshot = {
        ...delta,
        org: delta.org ?? progressSnapshot?.org,
        kol: delta.kol ?? progressSnapshot?.kol,
        audience: delta.audience ?? progressSnapshot?.audience,
      };
      const snap = progressSnapshot;
      progressWrites = progressWrites
        .then(() =>
          prisma.analysisJob.update({
            where: { id: jobId },
            data: { progress: snap as unknown as Prisma.InputJsonValue },
          })
        )
        .catch(() => {
          /* best-effort: never fail the analysis on a progress write */
        });
    };

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
      { twitter, llm, caps, onProgress: persistProgress }
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
      // Which scoring algorithm produced these numbers — what instant reuse
      // filters on, so a later algorithm never serves this row.
      scoringVersion: SCORING_VERSION,
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

    // RUNNING -> COMPLETED. Clear any error left by a failed earlier attempt:
    // the retry path stamps errorCode/errorMessage when it re-queues, so
    // without this a recovered analysis wears its transient error forever and
    // the admin panel shows "Completed + twitter_timeout" — reading as a
    // failure when the retry system in fact worked. `attempts` stays as the
    // honest retry record.
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
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

    // Transient-failure retry (Unit 26). job.attempts was already incremented at
    // the QUEUED->RUNNING transition (first run = 1). For a retryable code with
    // attempts left, re-enqueue with a linear backoff and leave the job QUEUED;
    // the delayed delivery re-enters processAnalysisRun (COMPLETED short-circuits
    // + upsert-by-requestId keep it idempotent). Never re-throw — that would risk
    // the whole pg-boss batch; retry is driven only by the explicit re-enqueue.
    const maxAttempts = posIntMin(process.env.ANALYSIS_MAX_ATTEMPTS, 3, 1);
    const retryDelaySeconds = posIntMin(
      process.env.ANALYSIS_RETRY_DELAY_SECONDS,
      60,
      1
    );

    if (decideRetry({ code, attempts: job.attempts, maxAttempts }).retry) {
      try {
        await prisma.analysisJob.update({
          where: { id: jobId },
          data: { status: "QUEUED", errorCode: code, errorMessage: message },
        });
        await enqueueAnalysisRun(
          { requestId, jobId },
          { startAfterSeconds: retryDelaySeconds * job.attempts } // linear backoff
        );
        console.warn(
          `[worker] analysis.run for request ${requestId} failed (${code}); retry ${job.attempts}/${maxAttempts} scheduled.`
        );
        return; // ack this delivery; the delayed job drives the retry
      } catch (reEnqueueError) {
        console.error(
          `[worker] failed to schedule retry for job ${jobId}; marking FAILED:`,
          reEnqueueError
        );
        // fall through to terminal FAILED
      }
    }

    try {
      // terminal (non-retryable OR attempts exhausted OR re-enqueue failed)
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
