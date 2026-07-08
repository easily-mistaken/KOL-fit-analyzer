import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads connection URLs from schema.prisma and does not
// auto-load .env. Load the repository-root .env so the Prisma CLI (migrate,
// introspect, studio) can reach Supabase when credentials are present.
loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations use the direct (non-pooled) Supabase connection. Falls back to
    // the pooled URL, then to an empty string so offline `prisma validate` /
    // `prisma generate` never throw when no database is configured.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
