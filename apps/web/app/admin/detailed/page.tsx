import { Sparkles } from "lucide-react";

import { isAdminConfigured, requireAdmin } from "@/lib/admin/auth";
import { listAdminDetailedRequests } from "@/lib/admin/queries";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminDetailedRequestsTable } from "@/components/admin/detailed-requests-table";
import { NotConfigured } from "@/components/admin/primitives";

// Live DB state behind an auth gate: never cached, never prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Concierge queue (Unit 35): detailed-report requests to fulfill manually. */
export default async function AdminDetailedRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  if (!isAdminConfigured()) return <NotConfigured />;
  await requireAdmin();

  const { cursor } = await searchParams;
  const data = await listAdminDetailedRequests({ cursor });

  return (
    <div className="space-y-8">
      <AdminNav />

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-5 w-5 text-accent-hover" />
          <span>Detailed reports</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Curated-report requests
        </h1>
        <p className="max-w-2xl text-sm text-secondary-foreground">
          People who asked for the hand-curated analysis. Deliver on Telegram,
          then mark the request sent.
        </p>
      </section>

      <AdminDetailedRequestsTable data={data} />
    </div>
  );
}
