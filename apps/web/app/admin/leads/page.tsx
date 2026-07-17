import { Inbox } from "lucide-react";

import { prisma } from "@kol-fit/db";

import { isAdminConfigured, requireAdmin } from "@/lib/admin/auth";
import {
  listAdminDetailedRequests,
  listAdminLeads,
} from "@/lib/admin/queries";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminDetailedRequestsTable } from "@/components/admin/detailed-requests-table";
import { AdminLeadsTable } from "@/components/admin/leads-table";
import { NotConfigured } from "@/components/admin/primitives";

// Live DB state behind an auth gate: never cached, never prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Leads (consolidated, Unit 39.1): the concierge detailed-report queue IS the
 * lead list now that the old email-capture component is gone. Legacy email
 * captures (pre-concierge ReportDelivery rows) are preserved below.
 */
export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  if (!isAdminConfigured()) return <NotConfigured />;
  await requireAdmin();

  const { cursor } = await searchParams;
  const [requests, legacy] = await Promise.all([
    listAdminDetailedRequests({ cursor }),
    listAdminLeads({ limit: 50 }),
  ]);

  // Chat-style read semantics (Unit 40.1): opening the queue marks everything
  // seen — the nav badge (counts unseen) clears on the next fetch. Best-effort;
  // workflow status (NEW/SENT/DISMISSED) is untouched.
  await prisma.detailedReportRequest
    .updateMany({ where: { seenAt: null }, data: { seenAt: new Date() } })
    .catch(() => {});

  return (
    <div className="space-y-8">
      <AdminNav />

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Inbox className="h-5 w-5 text-accent-ink" />
          <span>Leads</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Curated-report requests
        </h1>
        <p className="max-w-2xl text-sm text-secondary-foreground">
          Everyone who asked for the hand-curated analysis, with their Telegram,
          X handle, and email. Deliver on Telegram, then mark the request sent.
        </p>
      </section>

      <AdminDetailedRequestsTable data={requests} />

      {legacy.items.length > 0 && (
        <section className="space-y-3 border-t border-default pt-6">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Legacy email captures (pre-concierge)
          </h2>
          <AdminLeadsTable data={{ items: legacy.items, nextCursor: null }} />
        </section>
      )}
    </div>
  );
}
