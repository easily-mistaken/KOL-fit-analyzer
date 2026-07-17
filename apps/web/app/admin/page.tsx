import { Activity, Gauge } from "lucide-react";
import type { JobStatus, ReportVerdict } from "@kol-fit/shared";

import { isAdminConfigured, requireAdmin } from "@/lib/admin/auth";
import { getAdminOverview } from "@/lib/admin/queries";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminAnalysesTable } from "@/components/admin/analyses-table";
import { StatCard } from "@/components/admin/stat-card";
import {
  EmptyState,
  NotConfigured,
  formatInt,
  formatUsd,
} from "@/components/admin/primitives";
import { VerdictBadge } from "@/components/report/verdict-badge";
import type { HandleCount } from "@/lib/admin/types";

// Live DB state behind an auth gate: never cached, never prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JOB_ORDER: JobStatus[] = ["QUEUED", "RUNNING", "COMPLETED", "FAILED"];
const JOB_TONE: Partial<Record<JobStatus, "success" | "warning" | "error">> = {
  RUNNING: "warning",
  COMPLETED: "success",
  FAILED: "error",
};
const VERDICT_ORDER: ReportVerdict[] = ["STRONG", "GOOD", "OKAY", "WEAK", "AVOID"];

/** Operator overview: usage, job health, leads, spend and cap headroom. */
export default async function AdminOverviewPage() {
  if (!isAdminConfigured()) return <NotConfigured />;
  await requireAdmin();

  const o = await getAdminOverview();
  const { limits } = o;
  const analysesPct =
    limits.globalPerDay > 0
      ? Math.min(100, Math.round((limits.analysesLast24h / limits.globalPerDay) * 100))
      : 0;
  const spendCapped = limits.maxDailySpendUsd > 0;
  const spendPct = spendCapped
    ? Math.min(100, Math.round((limits.spendLast24hUsd / limits.maxDailySpendUsd) * 100))
    : 0;

  return (
    <div className="space-y-8">
      <AdminNav />

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-5 w-5 text-accent-hover" />
          <span>Overview</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          What&apos;s happening
        </h1>
        <p className="max-w-2xl text-sm text-secondary-foreground">
          Live counts straight from the database. Read-only.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Analyses (24h)"
          value={formatInt(o.analyses.last24h)}
          hint={`7d ${formatInt(o.analyses.last7d)} · all-time ${formatInt(o.analyses.allTime)}`}
        />
        <StatCard
          label="Browsers (24h)"
          value={formatInt(o.owners.last24h)}
          hint={`7d ${formatInt(o.owners.last7d)} · all-time ${formatInt(o.owners.allTime)}`}
        />
        <StatCard
          label="Leads (all-time)"
          value={formatInt(o.leads.total.allTime)}
          hint={`24h ${formatInt(o.leads.total.last24h)} · 7d ${formatInt(o.leads.total.last7d)}`}
        />
        <StatCard
          label="Distinct contacts"
          value={formatInt(o.leads.distinctEmails)}
          hint={`emails · ${formatInt(o.leads.distinctTelegram)} Telegram handles`}
        />
        <StatCard
          label="Emails delivered"
          value={formatInt(o.leads.emailsSent)}
          hint={`${formatInt(o.leads.emailsFailed)} failed`}
          tone={o.leads.emailsFailed > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Spend (24h)"
          value={formatUsd(o.spend.costUsd.last24h)}
          hint={`all-time ${formatUsd(o.spend.costUsd.allTime)} · ${formatInt(
            o.spend.providerRequests.allTime
          )} provider requests`}
        />
        <StatCard
          label="Tokens in (all-time)"
          value={formatInt(o.spend.tokensIn.allTime)}
          hint={`24h ${formatInt(o.spend.tokensIn.last24h)}`}
        />
        <StatCard
          label="Tokens out (all-time)"
          value={formatInt(o.spend.tokensOut.allTime)}
          hint={`24h ${formatInt(o.spend.tokensOut.last24h)}`}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Jobs</h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {JOB_ORDER.map((status) => (
            <StatCard
              key={status}
              label={status.toLowerCase()}
              value={formatInt(o.jobs[status])}
              tone={o.jobs[status] > 0 ? JOB_TONE[status] : undefined}
            />
          ))}
        </div>
      </section>

      {/* Headroom against the Unit 26 abuse caps, over the same rolling 24h window. */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Daily cap headroom</h2>
        <div className="space-y-2 rounded-xl border border-default bg-surface p-4 text-sm shadow-card">
          <p className="flex items-center gap-2 text-secondary-foreground">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Analyses today:{" "}
            <span className="font-mono text-foreground">
              {formatInt(limits.analysesLast24h)} / {formatInt(limits.globalPerDay)}
            </span>
            <span className="text-muted-foreground">
              ({analysesPct}% of the global daily cap · {formatInt(limits.perOwnerPerDay)}{" "}
              per browser)
            </span>
          </p>
          <p className="flex items-center gap-2 text-secondary-foreground">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Spend today:{" "}
            <span className="font-mono text-foreground">
              {formatUsd(limits.spendLast24hUsd)}
              {spendCapped && ` / ${formatUsd(limits.maxDailySpendUsd)}`}
            </span>
            <span className="text-muted-foreground">
              {spendCapped ? `(${spendPct}% of the daily spend cap)` : "(no spend cap set)"}
            </span>
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Verdict mix</h2>
        <div className="flex flex-wrap gap-3 rounded-xl border border-default bg-surface p-4 shadow-card">
          {VERDICT_ORDER.map((verdict) => (
            <div key={verdict} className="flex items-center gap-2">
              <VerdictBadge verdict={verdict} />
              <span className="font-mono text-sm text-foreground">
                {formatInt(o.verdicts[verdict])}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <HandleList title="Top creators" items={o.topKols} />
        <HandleList title="Top orgs" items={o.topOrgs} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
        <AdminAnalysesTable rows={o.recent} />
      </section>
    </div>
  );
}

function HandleList({ title, items }: { title: string; items: HandleCount[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {items.length === 0 ? (
        <EmptyState title="Nothing yet" hint="No analyses have run." />
      ) : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface shadow-card">
          {items.map((item) => (
            <li
              key={item.handle}
              className="flex items-center justify-between px-4 py-2.5 text-sm"
            >
              <span className="truncate text-foreground">@{item.handle}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatInt(item.count)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
