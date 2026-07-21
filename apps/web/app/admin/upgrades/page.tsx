import { TrendingUp } from "lucide-react";

import { prisma } from "@kol-fit/db";

import { isAdminConfigured, requireAdmin } from "@/lib/admin/auth";
import { listAdminLimitRaiseRequests } from "@/lib/admin/queries";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminLimitRequestsTable } from "@/components/admin/limit-requests-table";
import { NotConfigured } from "@/components/admin/primitives";

// Live DB state behind an auth gate: never cached, never prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Allowance-raise queue (Unit 47): users asking to unlock more analyses. */
export default async function AdminUpgradesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  if (!isAdminConfigured()) return <NotConfigured />;
  await requireAdmin();

  const { cursor } = await searchParams;
  const requests = await listAdminLimitRaiseRequests({ cursor });

  // Chat-style read semantics: opening the queue marks pending requests seen so
  // the nav badge clears. Best-effort; workflow status is untouched.
  await prisma.limitRaiseRequest
    .updateMany({ where: { seenAt: null }, data: { seenAt: new Date() } })
    .catch(() => {});

  return (
    <div className="space-y-8">
      <AdminNav />

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-5 w-5 text-accent-ink" />
          <span>Upgrades</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Analysis-limit requests
        </h1>
        <p className="max-w-2xl text-sm text-secondary-foreground">
          Signed-in users asking to unlock the next rung (10 → 25 → 50).
          Approving takes effect on their next run. Each carries a way to reach
          them for feedback — the reason we ask.
        </p>
      </section>

      <AdminLimitRequestsTable data={requests} />
    </div>
  );
}
