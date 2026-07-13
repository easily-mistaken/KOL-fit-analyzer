import { Mail } from "lucide-react";

import { isAdminConfigured, requireAdmin } from "@/lib/admin/auth";
import { listAdminLeads } from "@/lib/admin/queries";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminLeadsTable } from "@/components/admin/leads-table";
import { NotConfigured } from "@/components/admin/primitives";

// Live DB state behind an auth gate: never cached, never prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every captured lead (ReportDelivery row) across all owners. Read-only. */
export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  if (!isAdminConfigured()) return <NotConfigured />;
  await requireAdmin();

  const { cursor } = await searchParams;
  const data = await listAdminLeads({ cursor });

  return (
    <div className="space-y-8">
      <AdminNav />

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-5 w-5 text-accent-hover" />
          <span>Leads</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Captured emails &amp; Telegram handles
        </h1>
        <p className="max-w-2xl text-sm text-secondary-foreground">
          Everyone who asked for a report, with the per-channel delivery status.
        </p>
      </section>

      <AdminLeadsTable data={data} />
    </div>
  );
}
