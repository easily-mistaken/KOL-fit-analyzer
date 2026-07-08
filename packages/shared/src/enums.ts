import { z } from "zod";

// These enums MIRROR the Prisma enums in packages/db/prisma/schema.prisma.
// The Prisma schema is the source of truth for the database; these Zod enums
// exist so API/UI/worker code can validate the same values without depending
// on @kol-fit/db. Keep the value lists byte-for-byte identical.

export const JobStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const ReportStatusSchema = z.enum(["PENDING", "COMPLETED", "FAILED"]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const ReportVerdictSchema = z.enum([
  "STRONG",
  "GOOD",
  "OKAY",
  "WEAK",
  "AVOID",
]);
export type ReportVerdict = z.infer<typeof ReportVerdictSchema>;

export const EngagementSourceSchema = z.enum([
  "REPLY",
  "QUOTE",
  "RETWEET",
  "FOLLOWER",
]);
export type EngagementSource = z.infer<typeof EngagementSourceSchema>;
