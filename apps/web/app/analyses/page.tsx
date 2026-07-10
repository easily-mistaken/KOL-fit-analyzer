import { FileText } from "lucide-react";

import { AnalysesList } from "@/components/analyses-list";
import {
  clampLimit,
  listAnalyses,
  type AnalysisListResponse,
} from "@/lib/analyses-list";

// The list reflects live job state; always render fresh from the DB.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saved-reports index (Unit 20). Server Component: reads the first page directly
 * via listAnalyses() (no self-fetch) and renders the list. `?cursor` server-
 * renders the next page for "Load more". Read-only — no scoring/provider logic.
 */
export default async function AnalysesListPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; limit?: string }>;
}) {
  const { cursor, limit } = await searchParams;

  let data: AnalysisListResponse | null = null;
  try {
    data = await listAnalyses({ limit: clampLimit(limit), cursor });
  } catch (error) {
    console.error("[/analyses] failed to load analyses:", error);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-5 w-5 text-accent-hover" />
          <span>Reports</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Saved analyses
        </h1>
        <p className="max-w-2xl text-sm text-secondary-foreground">
          Every KOL fit analysis, newest first. Open any row to view its full
          report.
        </p>
      </section>

      {data ? (
        <AnalysesList data={data} />
      ) : (
        <div className="rounded-xl border border-error/40 bg-surface px-6 py-10 text-center text-sm text-error">
          Couldn&apos;t load reports. Please refresh to try again.
        </div>
      )}
    </div>
  );
}
