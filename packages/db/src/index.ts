// Public surface of @kol-fit/db.
//
// Consumers import the shared Prisma client singleton and all generated model
// types and enums (JobStatus, ReportStatus, ReportVerdict, EngagementSource,
// the Prisma namespace, etc.) from here rather than reaching into
// @prisma/client or the generated output directly.
export { prisma } from "./client.js";
export * from "./generated/prisma/client.js";
