import { FileText, Search } from "lucide-react";

import { isAdminConfigured, requireAdmin } from "@/lib/admin/auth";
import { listAdminAnalyses } from "@/lib/admin/queries";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminAnalysesTable } from "@/components/admin/analyses-table";
import { NotConfigured } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Live DB state behind an auth gate: never cached, never prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every analysis, all owners (not owner-scoped, unlike /analyses). Read-only. */
export default async function AdminAnalysesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; q?: string }>;
}) {
  if (!isAdminConfigured()) return <NotConfigured />;
  await requireAdmin();

  const { cursor, q } = await searchParams;
  const query = q?.trim() || undefined;
  const data = await listAdminAnalyses({ cursor, q: query });

  return (
    <div className="space-y-8">
      <AdminNav />

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-5 w-5 text-accent-hover" />
          <span>Analyses</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          All analyses
        </h1>
        <p className="max-w-2xl text-sm text-secondary-foreground">
          Every request across every browser, newest first.
        </p>
      </section>

      {/* Plain GET form: the query lives in the URL, so the page stays a Server Component. */}
      <form method="get" action="/admin/analyses" className="flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Search handle or owner id"
            aria-label="Search analyses"
            autoCapitalize="none"
            spellCheck={false}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <AdminAnalysesTable
        rows={data.items}
        nextCursor={data.nextCursor}
        q={query}
      />
    </div>
  );
}
