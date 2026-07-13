import { Coins } from "lucide-react";

import { isAdminConfigured, requireAdmin } from "@/lib/admin/auth";
import { getAdminUsage } from "@/lib/admin/queries";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminUsageTables } from "@/components/admin/usage-tables";
import { NotConfigured } from "@/components/admin/primitives";

// Live DB state behind an auth gate: never cached, never prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Provider spend and tokens, from ProviderUsageLog. Read-only. */
export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  if (!isAdminConfigured()) return <NotConfigured />;
  await requireAdmin();

  const { cursor } = await searchParams;
  const usage = await getAdminUsage({ cursor });

  return (
    <div className="space-y-8">
      <AdminNav />

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coins className="h-5 w-5 text-accent-hover" />
          <span>Usage</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Provider spend
        </h1>
        <p className="max-w-2xl text-sm text-secondary-foreground">
          What each provider was called for, how many tokens it used, and what it
          cost.
        </p>
      </section>

      <AdminUsageTables usage={usage} />
    </div>
  );
}
