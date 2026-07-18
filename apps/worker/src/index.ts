// Load the repo-root .env before importing anything that reads process.env
// at module load (Prisma client construction, pg-boss connection).
import "./env.js";

import { prisma } from "@kol-fit/db";
import { getBoss, stopBoss, QUEUE_NAMES } from "@kol-fit/queue";
import { APP_NAME } from "@kol-fit/shared";

import { processAnalysisRun } from "./handlers/analysis-run.js";

async function main(): Promise<void> {
  console.log(`${APP_NAME} worker booted`);

  // Provider-safety signpost (Unit 26). Warn loudly when LIVE paid providers are
  // active so real third-party spend is never a surprise. No secrets in the log.
  const liveProviders: string[] = [];
  if (process.env.TWITTER_PROVIDER === "twitterapi") {
    liveProviders.push("TwitterAPI.io");
  }
  if (process.env.LLM_PROVIDER === "openai") {
    liveProviders.push("OpenAI");
  }
  if (liveProviders.length > 0) {
    console.warn(
      `[worker] LIVE providers active (${liveProviders.join(", ")}); analyses will incur real third-party spend. Abuse/cost caps (Unit 26) bound worst-case usage.`
    );
  }

  const boss = await getBoss();

  // Strictly sequential processing. NOTE: batchSize:1 alone does NOT serialize —
  // pg-boss polls on an interval and invokes this handler for the next job
  // WITHOUT waiting for the previous handler to resolve, so analyses overlap
  // (verified: two runs RUNNING at once). We serialize with an app-level mutex:
  // handler bodies are chained through `tail`, so only one processAnalysisRun
  // runs at a time. A queued analysis therefore waits for the current one to
  // fully complete (warming the brand's cached Twitter profile + org
  // classification) before it starts, so queuing several creators for the same
  // brand never re-fetches/re-pays for that brand. Trade-off: one analysis at a
  // time (fine at this scale; per-brand concurrency is the future upgrade).
  let tail: Promise<unknown> = Promise.resolve();
  await boss.work(
    QUEUE_NAMES.ANALYSIS_RUN,
    { batchSize: 1 },
    async (jobs: { id: string; data: unknown }[]) => {
      const run = async () => {
        for (const job of jobs) {
          await processAnalysisRun(job.data, job.id);
        }
      };
      // Run after everything already queued settles (ok OR error), so one bad
      // job can't break the chain. pg-boss marks THIS job done only once its
      // turn finishes, so a waiting job's row stays QUEUED until it starts.
      const turn = tail.then(run, run);
      tail = turn.catch(() => {});
      await turn;
    }
  );

  console.log(`[worker] listening on ${QUEUE_NAMES.ANALYSIS_RUN}`);
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] received ${signal}, shutting down...`);
  try {
    await stopBoss();
    await prisma.$disconnect();
  } catch (error) {
    console.error("[worker] error during shutdown:", error);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error("[worker] unhandledRejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[worker] uncaughtException:", error);
});

main().catch((error) => {
  console.error("[worker] failed to start:", error);
  process.exit(1);
});
