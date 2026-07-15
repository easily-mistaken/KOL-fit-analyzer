import { QUEUE_NAMES } from "./constants.js";

// Lazy, cached pg-boss singleton.
//
// pg-boss relies on session-level Postgres features (LISTEN/NOTIFY, advisory
// locks) that break under PgBouncer transaction pooling, so it connects via the
// DIRECT (non-pooled) connection. The instance is constructed and started only
// on first use (never at import time), so importing this module does not open a
// connection — keeping `next build` and the client/build graph clean.
//
// pg-boss 12 is ESM-only; it is loaded via dynamic import() from this CJS
// package (no static/top-level import of the ESM module is needed). The boss
// type is derived from that dynamic import so no `resolution-mode` type import
// is required.
type Boss = Awaited<ReturnType<typeof createStartedBoss>>;

const globalForBoss = globalThis as unknown as {
  __kolFitBoss?: Promise<Boss>;
};

function connectionString(): string {
  return process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
}

/**
 * Pool sizing + role options (2026-07-15 incident): Supabase's session pooler
 * caps clients (pool_size 15 by default). pg-boss's default pg Pool is 10 per
 * process, so web (enqueue-only) + worker together exceeded the cap after a
 * pooler idle-drop reconnect (EMAXCONNSESSION storm). Enqueue-only processes
 * get a tiny pool and no supervision/scheduling loops; the worker (identified
 * by PGBOSS_ROLE=worker, set in apps/worker) gets a small one. Overridable via
 * PGBOSS_POOL_MAX. Pure + exported for the regression check.
 */
export function resolvePgBossOptions(
  env: Record<string, string | undefined> = process.env
): { max: number; supervise: boolean; schedule: boolean } {
  const isWorker = (env.PGBOSS_ROLE ?? "").trim().toLowerCase() === "worker";
  const fromEnv = Number(env.PGBOSS_POOL_MAX);
  const max =
    Number.isFinite(fromEnv) && fromEnv > 0
      ? Math.trunc(fromEnv)
      : isWorker
        ? 5
        : 2;
  return { max, supervise: isWorker, schedule: isWorker };
}

async function createStartedBoss() {
  const { PgBoss } = await import("pg-boss");
  const boss = new PgBoss({
    connectionString: connectionString(),
    ...resolvePgBossOptions(),
  });
  // Surface async pg-boss errors instead of crashing the process.
  boss.on("error", (error) => {
    console.error("[queue] pg-boss error:", error);
  });
  // start() creates pg-boss's own schema/tables on first run.
  await boss.start();
  // Idempotent (INSERT ... ON CONFLICT DO NOTHING); safe on every process init.
  await boss.createQueue(QUEUE_NAMES.ANALYSIS_RUN);
  await boss.createQueue(QUEUE_NAMES.REPORT_DELIVER);
  return boss;
}

/** Returns the started pg-boss singleton, creating it on first call. */
export function getBoss(): Promise<Boss> {
  if (!globalForBoss.__kolFitBoss) {
    globalForBoss.__kolFitBoss = createStartedBoss().catch((error: unknown) => {
      // Reset the cache so a later call can retry after a transient failure.
      globalForBoss.__kolFitBoss = undefined;
      throw error;
    });
  }
  return globalForBoss.__kolFitBoss;
}

/** Gracefully stops the singleton (used by the worker/tests; no-op if unstarted). */
export async function stopBoss(): Promise<void> {
  const pending = globalForBoss.__kolFitBoss;
  globalForBoss.__kolFitBoss = undefined;
  if (!pending) return;
  try {
    const boss = await pending;
    await boss.stop();
  } catch {
    // Never started successfully / already stopped — nothing to clean up.
  }
}
