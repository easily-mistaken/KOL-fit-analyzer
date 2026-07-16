import { prisma } from "@kol-fit/db";
import {
  resolveAbuseLimits,
  type JobStatus,
  type ReportVerdict,
} from "@kol-fit/shared";

import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from "@/lib/analyses-list";
import type {
  AdminAnalysisRow,
  AdminDetailedRequestRow,
  AdminLeadRow,
  AdminOverview,
  AdminUsage,
  AdminUsageRow,
  AdminUsageTotals,
  HandleCount,
  Page,
  WindowCount,
} from "./types";

// Admin data layer (Unit 27). Every export here is a read-only projection of
// saved DB state across ALL owners — the admin panel is deliberately not
// owner-scoped (that is the whole point of it). No writes, no scoring, no
// provider calls. Access is gated upstream by requireAdmin() (lib/admin/auth.ts);
// nothing in this module authorizes anything on its own.

const TOP_HANDLES = 8; // rows in the top-KOLs / top-orgs tables
const RECENT_ANALYSES = 8; // rows in the overview activity feed

/** Clamps an untrusted page size, mirroring lib/analyses-list.ts. */
function takeFor(limit: number | undefined): number {
  const n = limit ?? DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(1, Math.trunc(n)), MAX_LIST_LIMIT);
}

const iso = (d: Date): string => d.toISOString();

/** Prisma Decimal (nullable) / nullable Int -> a plain number, empty === 0. */
const num = (v: { toString(): string } | number | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v);

/** Start of each rolling window. `allTime` is expressed as "no filter". */
function windowStarts(now: number): { last24h: Date; last7d: Date } {
  const hour = 60 * 60 * 1000;
  return {
    last24h: new Date(now - 24 * hour),
    last7d: new Date(now - 7 * 24 * hour),
  };
}

// The columns every AdminAnalysisRow needs. Shared by listAdminAnalyses and the
// overview's `recent` feed so the two cannot drift. Summary columns only —
// never the heavy Report.report / Report.scores JSON.
const ANALYSIS_ROW_SELECT = {
  id: true,
  createdAt: true,
  orgHandle: true,
  kolHandle: true,
  ownerId: true,
  job: { select: { status: true, attempts: true, errorCode: true } },
  report: { select: { verdict: true, overallScore: true } },
} as const;

type AnalysisRowRecord = {
  id: string;
  createdAt: Date;
  orgHandle: string;
  kolHandle: string;
  ownerId: string | null;
  job: { status: JobStatus; attempts: number; errorCode: string | null } | null;
  report: { verdict: ReportVerdict | null; overallScore: number | null } | null;
};

function toAnalysisRow(r: AnalysisRowRecord): AdminAnalysisRow {
  return {
    id: r.id,
    createdAt: iso(r.createdAt),
    orgHandle: r.orgHandle,
    kolHandle: r.kolHandle,
    ownerId: r.ownerId,
    jobStatus: r.job?.status ?? null,
    attempts: r.job?.attempts ?? null,
    errorCode: r.job?.errorCode ?? null,
    verdict: r.report?.verdict ?? null,
    overallScore: r.report?.overallScore ?? null,
  };
}

/**
 * System-wide KPIs for /admin: usage, live job state, leads, provider spend,
 * headroom against the Unit 26 caps, verdict mix, top handles and recent
 * activity. Batched into one $transaction so the page costs a single round-trip
 * rather than ~20 sequential ones.
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  const { last24h, last7d } = windowStarts(Date.now());
  const in24h = { createdAt: { gte: last24h } };
  const in7d = { createdAt: { gte: last7d } };

  // Aggregate shape reused for all three spend windows.
  const spendAgg = {
    _sum: {
      costUsd: true,
      tokensIn: true,
      tokensOut: true,
      requests: true,
    },
  } as const;

  // The scalar counts/aggregates go in one $transaction (a single round-trip).
  // The groupBy calls are issued alongside it rather than inside it: Prisma
  // erases groupBy's payload types when it is passed through $transaction's
  // array overload, which would force `any`-shaped casts here. Both batches are
  // read-only, so they need no shared snapshot.
  const [scalars, groups] = await Promise.all([
    prisma.$transaction([
      prisma.analysisRequest.count({ where: in24h }),
      prisma.analysisRequest.count({ where: in7d }),
      prisma.analysisRequest.count(),

      prisma.reportDelivery.count({ where: in24h }),
      prisma.reportDelivery.count({ where: in7d }),
      prisma.reportDelivery.count(),
      prisma.reportDelivery.count({ where: { emailStatus: "SENT" } }),
      prisma.reportDelivery.count({ where: { emailStatus: "FAILED" } }),

      prisma.providerUsageLog.aggregate({ ...spendAgg, where: in24h }),
      prisma.providerUsageLog.aggregate({ ...spendAgg, where: in7d }),
      prisma.providerUsageLog.aggregate(spendAgg),

      prisma.analysisRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: RECENT_ANALYSES,
        select: ANALYSIS_ROW_SELECT,
      }),
    ]),
    Promise.all([
      prisma.analysisJob.groupBy({ by: ["status"], _count: { status: true } }),

      // Distinct browsers. groupBy collapses to one row per owner, so the row
      // count is the distinct count. Null owners are pre-cookie rows, not people.
      prisma.analysisRequest.groupBy({
        by: ["ownerId"],
        where: { ownerId: { not: null }, ...in24h },
      }),
      prisma.analysisRequest.groupBy({
        by: ["ownerId"],
        where: { ownerId: { not: null }, ...in7d },
      }),
      prisma.analysisRequest.groupBy({
        by: ["ownerId"],
        where: { ownerId: { not: null } },
      }),

      prisma.reportDelivery.groupBy({
        by: ["email"],
        where: { email: { not: null } },
      }),
      prisma.reportDelivery.groupBy({
        by: ["telegramHandle"],
        where: { telegramHandle: { not: null } },
      }),

      prisma.report.groupBy({
        by: ["verdict"],
        where: { verdict: { not: null } },
        _count: { verdict: true },
      }),

      prisma.analysisRequest.groupBy({
        by: ["kolHandle"],
        _count: { kolHandle: true },
        orderBy: { _count: { kolHandle: "desc" } },
        take: TOP_HANDLES,
      }),
      prisma.analysisRequest.groupBy({
        by: ["orgHandle"],
        _count: { orgHandle: true },
        orderBy: { _count: { orgHandle: "desc" } },
        take: TOP_HANDLES,
      }),
    ]),
  ]);

  const [
    analyses24h,
    analyses7d,
    analysesAll,
    leads24h,
    leads7d,
    leadsAll,
    emailsSent,
    emailsFailed,
    spend24h,
    spend7d,
    spendAll,
    recent,
  ] = scalars;

  const [
    jobGroups,
    owners24h,
    owners7d,
    ownersAll,
    emailGroups,
    telegramGroups,
    verdictGroups,
    topKolGroups,
    topOrgGroups,
  ] = groups;

  // Every enum key must be present even with no rows, so the UI can render a
  // stable set of tiles instead of a ragged one.
  const jobs: Record<JobStatus, number> = {
    QUEUED: 0,
    RUNNING: 0,
    COMPLETED: 0,
    FAILED: 0,
  };
  for (const g of jobGroups) jobs[g.status] = g._count.status;

  const verdicts: Record<ReportVerdict, number> = {
    STRONG: 0,
    GOOD: 0,
    OKAY: 0,
    WEAK: 0,
    AVOID: 0,
  };
  for (const g of verdictGroups) {
    if (g.verdict) verdicts[g.verdict] = g._count.verdict;
  }

  const costUsd: WindowCount = {
    last24h: num(spend24h._sum.costUsd),
    last7d: num(spend7d._sum.costUsd),
    allTime: num(spendAll._sum.costUsd),
  };

  const limits = resolveAbuseLimits(process.env);

  const topKols: HandleCount[] = topKolGroups.map((g) => ({
    handle: g.kolHandle,
    count: g._count.kolHandle,
  }));
  const topOrgs: HandleCount[] = topOrgGroups.map((g) => ({
    handle: g.orgHandle,
    count: g._count.orgHandle,
  }));

  return {
    analyses: {
      last24h: analyses24h,
      last7d: analyses7d,
      allTime: analysesAll,
    },
    jobs,
    owners: {
      last24h: owners24h.length,
      last7d: owners7d.length,
      allTime: ownersAll.length,
    },
    leads: {
      total: { last24h: leads24h, last7d: leads7d, allTime: leadsAll },
      distinctEmails: emailGroups.length,
      distinctTelegram: telegramGroups.length,
      emailsSent,
      emailsFailed,
    },
    spend: {
      costUsd,
      tokensIn: {
        last24h: num(spend24h._sum.tokensIn),
        last7d: num(spend7d._sum.tokensIn),
        allTime: num(spendAll._sum.tokensIn),
      },
      tokensOut: {
        last24h: num(spend24h._sum.tokensOut),
        last7d: num(spend7d._sum.tokensOut),
        allTime: num(spendAll._sum.tokensOut),
      },
      providerRequests: {
        last24h: num(spend24h._sum.requests),
        last7d: num(spend7d._sum.requests),
        allTime: num(spendAll._sum.requests),
      },
    },
    // Headroom is measured over the same rolling 24h window the Unit 26 gate
    // uses, so these numbers match what the limiter would decide right now.
    limits: {
      analysesLast24h: analyses24h,
      globalPerDay: limits.globalPerDay,
      perOwnerPerDay: limits.perOwnerPerDay,
      maxDailySpendUsd: limits.maxDailySpendUsd,
      spendLast24hUsd: costUsd.last24h,
    },
    verdicts,
    topKols,
    topOrgs,
    recent: recent.map(toAnalysisRow),
  };
}

/**
 * Every analysis, newest first, across ALL owners — never owner-scoped. `q`
 * matches an org handle, KOL handle or owner id (case-insensitive substring).
 * `cursor` is an AnalysisRequest.id from a previous page's `nextCursor`.
 */
export async function listAdminAnalyses({
  limit,
  cursor,
  q,
}: {
  limit?: number;
  cursor?: string | null;
  q?: string | null;
} = {}): Promise<Page<AdminAnalysisRow>> {
  const take = takeFor(limit);
  const term = q?.trim();

  const rows = await prisma.analysisRequest.findMany({
    where: term
      ? {
          OR: [
            { orgHandle: { contains: term, mode: "insensitive" } },
            { kolHandle: { contains: term, mode: "insensitive" } },
            { ownerId: { contains: term, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: take + 1, // +1 sentinel to detect a next page
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: ANALYSIS_ROW_SELECT,
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return {
    items: page.map(toAnalysisRow),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

/**
 * The leads table: every ReportDelivery row (who gave an email / Telegram
 * handle), newest first, with the org/KOL pair it was for. `cursor` is a
 * ReportDelivery.id. The request behind a delivery can be missing (requestId is
 * nullable and set-null on delete), so the handles are nullable too.
 */
export async function listAdminLeads({
  limit,
  cursor,
}: {
  limit?: number;
  cursor?: string | null;
} = {}): Promise<Page<AdminLeadRow>> {
  const take = takeFor(limit);

  const rows = await prisma.reportDelivery.findMany({
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      createdAt: true,
      email: true,
      telegramHandle: true,
      emailStatus: true,
      telegramStatus: true,
      errorCode: true,
      report: {
        select: {
          request: { select: { id: true, orgHandle: true, kolHandle: true } },
        },
      },
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  const items: AdminLeadRow[] = page.map((r) => {
    const request = r.report?.request ?? null;
    return {
      id: r.id,
      createdAt: iso(r.createdAt),
      email: r.email,
      telegramHandle: r.telegramHandle,
      emailStatus: r.emailStatus,
      telegramStatus: r.telegramStatus,
      errorCode: r.errorCode,
      requestId: request?.id ?? null,
      orgHandle: request?.orgHandle ?? null,
      kolHandle: request?.kolHandle ?? null,
    };
  });

  return {
    items,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

/**
 * Provider spend: all-time totals per provider, plus a cursor page of the most
 * recent ProviderUsageLog rows. `cursor` is a ProviderUsageLog.id.
 */
export async function getAdminUsage({
  limit,
  cursor,
}: {
  limit?: number;
  cursor?: string | null;
} = {}): Promise<AdminUsage> {
  const take = takeFor(limit);

  // Issued in parallel rather than via $transaction: Prisma erases groupBy's
  // payload types through the $transaction array overload (see getAdminOverview).
  const [groups, rows] = await Promise.all([
    prisma.providerUsageLog.groupBy({
      by: ["provider"],
      _sum: {
        requests: true,
        tokensIn: true,
        tokensOut: true,
        costUsd: true,
      },
      _count: { _all: true },
    }),
    prisma.providerUsageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        createdAt: true,
        provider: true,
        operation: true,
        requests: true,
        tokensIn: true,
        tokensOut: true,
        costUsd: true,
        requestId: true,
      },
    }),
  ]);

  const totals: AdminUsageTotals[] = groups
    .map((g) => ({
      provider: g.provider,
      requests: num(g._sum.requests),
      tokensIn: num(g._sum.tokensIn),
      tokensOut: num(g._sum.tokensOut),
      costUsd: num(g._sum.costUsd),
      calls: g._count._all,
    }))
    // Costliest provider first — the number the operator actually looks for.
    .sort((a, b) => b.costUsd - a.costUsd);

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  const items: AdminUsageRow[] = page.map((r) => ({
    id: r.id,
    createdAt: iso(r.createdAt),
    provider: r.provider,
    operation: r.operation,
    requests: r.requests,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    // Decimal | null -> number | null: keep "never logged a cost" distinct from
    // "cost was 0" on the per-row table (unlike the summed totals above).
    costUsd: r.costUsd === null ? null : Number(r.costUsd),
    requestId: r.requestId,
  }));

  return {
    totals,
    rows: { items, nextCursor: hasMore ? page[page.length - 1].id : null },
  };
}

/** Detailed-report concierge requests (Unit 35), newest first. */
export async function listAdminDetailedRequests({
  limit,
  cursor,
}: {
  limit?: number;
  cursor?: string | null;
} = {}): Promise<Page<AdminDetailedRequestRow>> {
  const take = takeFor(limit);

  const rows = await prisma.detailedReportRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  const items: AdminDetailedRequestRow[] = page.map((r) => ({
    id: r.id,
    createdAt: iso(r.createdAt),
    status: r.status,
    telegram: r.telegram,
    xHandle: r.xHandle,
    note: r.note,
    orgHandle: r.orgHandle,
    kolHandle: r.kolHandle,
    analysisRequestId: r.analysisRequestId,
    userId: r.userId,
    fulfilledAt: r.fulfilledAt ? iso(r.fulfilledAt) : null,
  }));

  return {
    items,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}
