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

  // pg-boss 12 delivers jobs in a batch array; iterate and isolate per-job
  // errors (handled inside processAnalysisRun).
  await boss.work(
    QUEUE_NAMES.ANALYSIS_RUN,
    async (jobs: { id: string; data: unknown }[]) => {
      for (const job of jobs) {
        await processAnalysisRun(job.data, job.id);
      }
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
