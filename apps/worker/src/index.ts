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

  startQueueWatchdog(boss);
}

// Queue liveness watchdog (2026-09-12 incident). pg-boss reports connection
// failures through boss.on("error"), which only logs — so when the worker's
// pool was exhausted by half-open sockets the process stayed "up" and systemd
// never restarted it. The queue quietly stopped draining for 4.5 days while
// the web app kept accepting pairs that nothing would ever run.
//
// getQueue() is an uncached SELECT through the same pool pg-boss fetches jobs
// with (the exact call path that failed: Manager.getQueues), so it fails in
// precisely the cases that matter. After UNREACHABLE_EXIT_MS of unbroken
// failure we exit non-zero: scripts/start.mjs then brings the container down
// and systemd (Restart=always) starts a clean process with a fresh pool.
//
// The grace window is far longer than the restart interval, so a real outage
// can't trip systemd's StartLimitBurst (5 restarts / 60s) into giving up.
const WATCHDOG_INTERVAL_MS = 60_000;
const UNREACHABLE_EXIT_MS = 5 * 60_000;

function startQueueWatchdog(boss: Awaited<ReturnType<typeof getBoss>>): void {
  let lastHealthyAt = Date.now();
  let probing = false;

  const timer = setInterval(() => {
    // Never stack probes: a hung probe must not queue more pool requests.
    if (probing) return;
    probing = true;
    void (async () => {
      try {
        await boss.getQueue(QUEUE_NAMES.ANALYSIS_RUN);
        lastHealthyAt = Date.now();
      } catch (error) {
        const downMs = Date.now() - lastHealthyAt;
        console.error(
          `[worker] queue DB probe failed (unreachable for ${Math.round(downMs / 1000)}s):`,
          error
        );
        if (downMs >= UNREACHABLE_EXIT_MS) {
          console.error(
            `[worker] queue DB unreachable for ${Math.round(downMs / 1000)}s; exiting so the supervisor restarts with a fresh pool`
          );
          process.exit(1);
        }
      } finally {
        probing = false;
      }
    })();
  }, WATCHDOG_INTERVAL_MS);

  // Don't hold the event loop open on shutdown.
  timer.unref();
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
