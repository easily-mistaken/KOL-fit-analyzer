import { prisma } from "@kol-fit/db";

import { analysisErrorMessage } from "./errors.js";

// Stale-job sweep. A run marks itself RUNNING when it starts and COMPLETED or
// FAILED when it ends, but neither end is guaranteed: the process can be killed
// mid-run (OOM on the 2 GB box, a deploy restart), or the FAILED write itself
// can hit a DB blip and be swallowed. The row then stays RUNNING forever, the
// waiting screen polls it indefinitely, and the retry route refuses it because
// only FAILED analyses can be retried.
//
// Runs take 5-7 minutes and the worker processes one at a time, so a RUNNING
// row whose startedAt is older than STALE_AFTER_MS is not being worked on. It
// is marked FAILED (analysis_stalled) so the user gets a retry button. If a
// slow run does finish after being swept, its COMPLETED write still lands and
// wins. QUEUED rows are left alone: they can legitimately wait behind others.

const STALE_AFTER_MS = 30 * 60_000;
const SWEEP_INTERVAL_MS = 5 * 60_000;

/** Marks RUNNING jobs that started too long ago as FAILED. Returns the count. */
export async function failStaleRunningJobs(now = new Date()): Promise<number> {
  const { count } = await prisma.analysisJob.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: new Date(now.getTime() - STALE_AFTER_MS) },
    },
    data: {
      status: "FAILED",
      failedAt: now,
      errorCode: "analysis_stalled",
      errorMessage: analysisErrorMessage("analysis_stalled"),
    },
  });
  return count;
}

/** Sweeps once at boot (catches runs a crash or restart orphaned), then periodically. */
export function startStaleJobSweep(): void {
  let sweeping = false;
  const sweep = async (): Promise<void> => {
    if (sweeping) return;
    sweeping = true;
    try {
      const count = await failStaleRunningJobs();
      if (count > 0) {
        console.warn(
          `[worker] marked ${count} stalled RUNNING job(s) FAILED (analysis_stalled)`
        );
      }
    } catch (error) {
      // A DB blip here is harmless: the next sweep retries.
      console.error("[worker] stale-job sweep failed:", error);
    } finally {
      sweeping = false;
    }
  };
  void sweep();
  setInterval(() => void sweep(), SWEEP_INTERVAL_MS).unref();
}
