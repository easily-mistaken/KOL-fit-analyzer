import { Users } from "lucide-react";

import { prisma } from "@kol-fit/db";

import { isAdminConfigured, requireAdmin } from "@/lib/admin/auth";
import { getAdminPeople } from "@/lib/admin/queries";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPeopleTable } from "@/components/admin/people-table";
import { StatCard } from "@/components/admin/stat-card";
import { NotConfigured, formatInt } from "@/components/admin/primitives";

// Live DB state behind an auth gate: never cached, never prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * People (Unit 44): every human we can actually reach, one row each.
 *
 * The overview's "Browsers" stat counts anonymous cookies, which is a traffic
 * number, not a contact list — this page is the contact list.
 */
export default async function AdminPeoplePage() {
  if (!isAdminConfigured()) return <NotConfigured />;
  await requireAdmin();

  const people = await getAdminPeople();

  // Chat-style read semantics, mirroring the leads queue: opening this page
  // marks captured emails seen so the nav badge clears.
  await prisma.lead
    .updateMany({ where: { seenAt: null }, data: { seenAt: new Date() } })
    .catch(() => {});

  return (
    <div className="space-y-8">
      <AdminNav />

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-5 w-5 text-accent-ink" />
          <span>People</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Who&apos;s using this
        </h1>
        <p className="max-w-2xl text-sm text-secondary-foreground">
          Signed-in accounts and captured emails, merged into one row per person.
          Newest activity first.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="People" value={formatInt(people.totals.people)} />
        <StatCard
          label="With an account"
          value={formatInt(people.totals.accounts)}
          hint="signed in with Google"
        />
        <StatCard
          label="Captured emails"
          value={formatInt(people.totals.leads)}
          hint="left an address on a report"
        />
        <StatCard
          label="Not contacted"
          value={formatInt(people.totals.uncontacted)}
          hint="no outreach recorded yet"
        />
      </section>

      <AdminPeopleTable rows={people.rows} />
    </div>
  );
}
