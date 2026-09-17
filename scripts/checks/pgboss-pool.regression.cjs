// Regression for the 2026-07-15 EMAXCONNSESSION incident: Supabase's session
// pooler caps clients at 15; pg-boss's default pool (10/process) let web +
// worker exceed it after an idle-drop reconnect. Pools are now role-sized and
// enqueue-only processes skip supervision/scheduling loops.
//
// Also covers the 2026-09-12 stuck-queue incident: the pooler dropped all 5 of
// the worker's connections with no FIN/RST, and because node-postgres leaves
// SO_KEEPALIVE off and no query timeout was set, the checked-out clients hung
// forever. The pool stayed exhausted and the queue silently stopped draining
// for 4.5 days. Socket-health options must never regress to the pg defaults.
//
// Run after `pnpm build`:  node scripts/checks/pgboss-pool.regression.cjs

const { resolvePgBossOptions } = require("../../packages/queue/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };

const web = resolvePgBossOptions({});
ck("enqueue-only default: max 2", web.max === 2);
ck("enqueue-only: no supervision/scheduling loops", web.supervise === false && web.schedule === false);

const worker = resolvePgBossOptions({ PGBOSS_ROLE: "worker" });
ck("worker default: max 5", worker.max === 5);
ck("worker keeps supervision + scheduling", worker.supervise === true && worker.schedule === true);
ck("web(2) + worker(5) fit under the 15-client session-pooler cap with restart headroom", web.max + worker.max * 2 <= 15);

ck("PGBOSS_POOL_MAX override wins", resolvePgBossOptions({ PGBOSS_ROLE: "worker", PGBOSS_POOL_MAX: "8" }).max === 8);
ck("invalid override falls back", resolvePgBossOptions({ PGBOSS_POOL_MAX: "-3" }).max === 2);

// --- Socket health (2026-09-12) -------------------------------------------
// Every role must get these; a half-open socket has to FAIL, never hang.
for (const [role, opts] of [["enqueue-only", web], ["worker", worker]]) {
  ck(`${role}: TCP keepalive enabled (pg defaults to false)`, opts.keepAlive === true);
  ck(
    `${role}: keepalive probes start well under the 2h system default`,
    Number.isFinite(opts.keepAliveInitialDelayMillis) &&
      opts.keepAliveInitialDelayMillis > 0 &&
      opts.keepAliveInitialDelayMillis <= 60_000
  );
  ck(
    `${role}: query_timeout bounded, so a dead socket releases its pool client`,
    Number.isFinite(opts.query_timeout) && opts.query_timeout > 0 && opts.query_timeout <= 120_000
  );
  ck(
    `${role}: connections recycled, bounding zombie lifetime`,
    Number.isFinite(opts.maxLifetimeSeconds) && opts.maxLifetimeSeconds > 0 && opts.maxLifetimeSeconds <= 3_600
  );
}

// The whole point of the incident: the pool must not be able to leak every
// slot permanently. With a bounded query_timeout, worst-case time for all
// `max` clients to be reclaimed is finite and well under the watchdog's exit
// window, so recovery happens without needing a process restart.
ck(
  "worker: query_timeout reclaims a fully-leaked pool faster than the 5min watchdog exit",
  worker.query_timeout < 5 * 60_000
);

console.log(`\nPGBOSS POOL REGRESSION: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
