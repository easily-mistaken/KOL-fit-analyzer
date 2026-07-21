import type { JobStatus, ReportVerdict } from "@kol-fit/shared";

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

// Detailed-report concierge requests (Unit 35).
export type AdminDetailedRequestRow = {
  id: string;
  createdAt: string; // ISO
  status: "NEW" | "SENT" | "DISMISSED";
  telegram: string;
  xHandle: string;
  email: string | null;
  note: string | null;
  orgHandle: string | null;
  kolHandle: string | null;
  analysisRequestId: string | null;
  userId: string | null;
  fulfilledAt: string | null; // ISO
};

// Allowance-raise requests (Unit 47).
export type AdminLimitRaiseRow = {
  id: string;
  createdAt: string; // ISO
  status: "PENDING" | "APPROVED" | "DECLINED";
  email: string | null;
  currentLimit: number;
  requestedLimit: number;
  contactTelegram: string | null;
  contactEmail: string | null;
  contactOtherLabel: string | null;
  contactOtherValue: string | null;
  note: string | null;
  userId: string | null;
  decidedAt: string | null; // ISO
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

/**
 * One PERSON in the admin CRM view (Unit 44), keyed by email.
 *
 * Merged from three places that each know part of the story: a signed-in
 * `User`, a captured `Lead`, and a `DetailedReportRequest`. Someone who did all
 * three is one human and must appear once — a list that shows them three times
 * is a list nobody trusts enough to work from.
 */
export type AdminPersonRow = {
  email: string;
  /** Has an actual account (Google sign-in). */
  hasAccount: boolean;
  /** Left their email via a capture form. */
  isLead: boolean;
  /** Asked for a concierge detailed report — the highest-intent signal here. */
  requestedDetailed: boolean;
  /** Where a lead was first captured; null for account-only people. */
  firstSource: string | null;
  /** Analyses run by the owner id(s) we can attribute to this person. */
  analyses: number;
  /** What they last looked at, when known — the outreach hook. */
  lastPair: { orgHandle: string | null; kolHandle: string | null } | null;
  firstSeen: string; // ISO
  lastSeen: string; // ISO
  /** Never contacted yet — drives the "needs outreach" filter. */
  contactedAt: string | null;
};

export type AdminPeople = {
  rows: AdminPersonRow[];
  totals: {
    people: number;
    accounts: number;
    leads: number;
    uncontacted: number;
  };
};
