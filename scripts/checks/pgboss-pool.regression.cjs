// Regression for the 2026-07-15 EMAXCONNSESSION incident: Supabase's session
// pooler caps clients at 15; pg-boss's default pool (10/process) let web +
// worker exceed it after an idle-drop reconnect. Pools are now role-sized and
// enqueue-only processes skip supervision/scheduling loops.
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

console.log(`\nPGBOSS POOL REGRESSION: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
