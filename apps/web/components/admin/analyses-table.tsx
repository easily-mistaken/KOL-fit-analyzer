import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VerdictBadge } from "@/components/report/verdict-badge";
import type { AdminAnalysisRow } from "@/lib/admin/types";
import {
  AdminRow,
  AdminTable,
  Dash,
  EmptyState,
  ErrorCode,
  JobStatusPill,
  OwnerId,
  formatDateTime,
} from "@/components/admin/primitives";

function scoreColor(v: number): string {
  return v >= 65 ? "text-success" : v >= 50 ? "text-warning" : "text-error";
}

/**
 * Every analysis across all owners. `nextCursor` renders the "Load more" link;
 * the overview's recent-activity feed reuses the same table without one.
 */
export function AdminAnalysesTable({
  rows,
  nextCursor,
  q,
}: {
  rows: AdminAnalysisRow[];
  nextCursor?: string | null;
  q?: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No analyses"
        hint={
          q
            ? "No analysis matches that handle or owner id."
            : "Nothing has been analyzed yet."
        }
      />
    );
  }

  // A search must survive pagination, so carry `q` into the cursor link.
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (nextCursor) params.set("cursor", nextCursor);

  return (
    <div className="space-y-4">
      <AdminTable
        minWidth={920}
        head={
          <>
            <th className="px-5 py-3 font-medium">Created</th>
            <th className="px-5 py-3 font-medium">KOL / Org</th>
            <th className="px-5 py-3 font-medium">Owner</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 text-right font-medium">Attempts</th>
            <th className="px-5 py-3 font-medium">Error</th>
            <th className="px-5 py-3 font-medium">Verdict</th>
            <th className="px-5 py-3 text-right font-medium">Score</th>
            <th className="px-5 py-3" aria-label="Open" />
          </>
        }
      >
        {rows.map((row) => (
          <AdminRow key={row.id}>
            <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-muted-foreground">
              {formatDateTime(row.createdAt)}
            </td>
            <td className="px-5 py-3.5">
              <span className="block font-medium text-foreground">
                @{row.kolHandle}
              </span>
              <span className="block text-xs text-muted-foreground">
                → @{row.orgHandle}
              </span>
            </td>
            <td className="px-5 py-3.5">
              <OwnerId id={row.ownerId} />
            </td>
            <td className="px-5 py-3.5">
              <JobStatusPill status={row.jobStatus} />
            </td>
            <td className="px-5 py-3.5 text-right font-mono text-xs text-secondary-foreground">
              {row.attempts ?? "—"}
            </td>
            <td className="px-5 py-3.5">
              <ErrorCode code={row.errorCode} />
            </td>
            <td className="px-5 py-3.5">
              <VerdictBadge verdict={row.verdict} />
            </td>
            <td className="px-5 py-3.5 text-right">
              {typeof row.overallScore === "number" ? (
                <span
                  className={cn(
                    "font-mono text-[15px] font-semibold",
                    scoreColor(row.overallScore)
                  )}
                >
                  {row.overallScore}
                </span>
              ) : (
                <Dash />
              )}
            </td>
            <td className="px-5 py-3.5 text-right">
              <Link
                href={`/analyses/${row.id}`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-accent-hover"
              >
                Open <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </td>
          </AdminRow>
        ))}
      </AdminTable>

      {nextCursor && (
        <div className="flex justify-center">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/analyses?${params.toString()}`}>Load more</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
