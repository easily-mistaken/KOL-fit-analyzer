import path from "node:path";

import { config } from "dotenv";

// A standalone Node process does not inherit Next's env loading. Load the
// repo-root .env BEFORE any module that reads process.env at import time
// (the Prisma client in @kol-fit/db constructs its adapter from DATABASE_URL on
// import; pg-boss reads DIRECT_URL on start). This module must be imported
// first in index.ts. dotenv is a no-op if the file is absent (offline-safe).
config({ path: path.resolve(process.cwd(), "../../.env") });
