import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";

// Prisma 7 connects through a driver adapter rather than a schema-level url.
// The pooled Supabase connection string is used for the runtime client.
const connectionString = process.env.DATABASE_URL ?? "";
const adapter = new PrismaPg(connectionString);

// Reuse a single client across hot-reloads / repeated imports in dev to avoid
// exhausting database connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
