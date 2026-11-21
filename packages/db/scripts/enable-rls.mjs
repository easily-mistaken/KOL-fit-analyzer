#!/usr/bin/env node
// Turn on row-level security for every table in the public schema that lacks
// it. Run after any `prisma db push` that adds a table:
//
//   cd packages/db && node scripts/enable-rls.mjs            # reads ../../.env
//   cd packages/db && node scripts/enable-rls.mjs --check    # report only
//
// Why: Supabase exposes the public schema through its REST API, and the anon
// key that reaches every browser (for Google sign-in) is granted SELECT on new
// tables there. Without RLS, anyone holding that key could read User, Lead and
// every other table. RLS with no policies denies those roles everything. The
// app is unaffected: Prisma connects as the table owner (`postgres`, BYPASSRLS),
// and no code reads tables through supabase-js. (Found and fixed 2026-11-21.)

import { config } from "dotenv";
import pg from "pg";

config({ path: new URL("../../../.env", import.meta.url).pathname, quiet: true });

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("No DIRECT_URL or DATABASE_URL.");
  process.exit(1);
}
const checkOnly = process.argv.includes("--check");

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query(
    "select tablename from pg_tables where schemaname = 'public' and not rowsecurity order by 1"
  );
  if (rows.length === 0) {
    console.log("RLS: every public table already has row-level security.");
  } else if (checkOnly) {
    console.log(`RLS missing on: ${rows.map((r) => r.tablename).join(", ")}`);
    process.exitCode = 2;
  } else {
    for (const { tablename } of rows) {
      await client.query(`alter table public."${tablename.replace(/"/g, '""')}" enable row level security`);
      console.log(`RLS enabled: ${tablename}`);
    }
  }
} finally {
  await client.end();
}
