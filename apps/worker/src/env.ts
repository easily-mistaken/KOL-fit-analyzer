import path from "node:path";

import { config } from "dotenv";

// A standalone Node process does not inherit Next's env loading. Load the
// repo-root .env BEFORE any module that reads process.env at import time
// (the Prisma client in @kol-fit/db constructs its adapter from DATABASE_URL on
// import; pg-boss reads DIRECT_URL on start). This module must be imported
// first in index.ts. dotenv is a no-op if the file is absent (offline-safe).
config({ path: path.resolve(process.cwd(), "../../.env") });

// Identify this process as the queue WORKER (before @kol-fit/queue is used):
// it gets pg-boss supervision/scheduling and a slightly larger pool, while
// enqueue-only processes (web) run tiny pools with no background loops —
// keeping total clients under Supabase's session-pooler cap (2026-07-15
// EMAXCONNSESSION incident).
process.env.PGBOSS_ROLE ??= "worker";
