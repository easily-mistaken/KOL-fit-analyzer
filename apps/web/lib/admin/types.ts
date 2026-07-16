import type { JobStatus, ReportVerdict } from "@kol-fit/shared";

/** Mirrors the Prisma DeliveryStatus enum (Unit 24); not in @kol-fit/shared. */
export type DeliveryStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

// DTOs for the admin panel (Unit 27). Defined once here so the query layer
// (lib/admin/queries.ts) and the admin pages/components cannot drift apart.
// Everything is a read-only projection of saved DB state — no scoring, no
// provider calls, no writes.

/** A count over a rolling window plus the all-time total. */
export type WindowCount = {
  last24h: number;
  last7d: number;
  allTime: number;
};

export type AdminOverview = {
  analyses: WindowCount;
  /** Live job state across all analyses, all owners. */
  jobs: Record<JobStatus, number>;
  /** Distinct owner cookies = distinct browsers/devices that used the tool. */
  owners: WindowCount;
  leads: {
    total: WindowCount;
    /** Distinct addresses/handles ever captured. */
    distinctEmails: number;
    distinctTelegram: number;
    /** Rows whose email actually went out. */
    emailsSent: number;
    emailsFailed: number;
  };
  spend: {
    /** Summed ProviderUsageLog.costUsd (null cost counts as 0). */
    costUsd: WindowCount;
    tokensIn: WindowCount;
    tokensOut: WindowCount;
    providerRequests: WindowCount;
  };
  /** Headroom against the Unit 26 abuse caps, over the same rolling 24h window. */
  limits: {
    analysesLast24h: number;
    globalPerDay: number;
    perOwnerPerDay: number;
    maxDailySpendUsd: number; // 0 = spend gate disabled
    spendLast24hUsd: number;
  };
  /** Verdict mix across completed reports (all time). */
  verdicts: Record<ReportVerdict, number>;
  topKols: HandleCount[];
  topOrgs: HandleCount[];
  recent: AdminAnalysisRow[]; // newest few, for an at-a-glance activity feed
};

export type HandleCount = {
  handle: string;
  count: number;
};

export type AdminAnalysisRow = {
  id: string; // AnalysisRequest.id
  createdAt: string; // ISO
  orgHandle: string;
  kolHandle: string;
  ownerId: string | null; // the anonymous browser cookie id
  jobStatus: JobStatus | null;
  attempts: number | null;
  errorCode: string | null;
  verdict: ReportVerdict | null;
  overallScore: number | null;
};

export type AdminLeadRow = {
  id: string; // ReportDelivery.id
  createdAt: string; // ISO
  email: string | null;
  telegramHandle: string | null;
  emailStatus: DeliveryStatus;
  telegramStatus: DeliveryStatus;
  errorCode: string | null;
  /** The analysis the lead asked for — null if the request row is gone. */
  requestId: string | null;
  orgHandle: string | null;
  kolHandle: string | null;
};

// Detailed-report concierge requests (Unit 35).
export type AdminDetailedRequestRow = {
  id: string;
  createdAt: string; // ISO
  status: "NEW" | "SENT" | "DISMISSED";
  telegram: string;
  xHandle: string;
  note: string | null;
  orgHandle: string | null;
  kolHandle: string | null;
  analysisRequestId: string | null;
  userId: string | null;
  fulfilledAt: string | null; // ISO
};

export type AdminUsageRow = {
  id: string;
  createdAt: string; // ISO
  provider: string; // "twitterapi" | "openai" | ...
  operation: string;
  requests: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  requestId: string | null;
};

export type AdminUsageTotals = {
  provider: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  calls: number; // number of log rows
};

export type AdminUsage = {
  totals: AdminUsageTotals[];
  rows: Page<AdminUsageRow>;
};

/** Cursor page, mirroring the reports-list idiom (lib/analyses-list.ts). */
export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};
