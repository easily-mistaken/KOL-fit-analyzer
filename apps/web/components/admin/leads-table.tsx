import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AdminLeadRow, Page } from "@/lib/admin/types";
import {
  AdminRow,
  AdminTable,
  Dash,
  DeliveryPill,
  EmptyState,
  ErrorCode,
  formatDateTime,
} from "@/components/admin/primitives";

/** Who left an email / Telegram handle, for which report, and how it delivered. */
export function AdminLeadsTable({ data }: { data: Page<AdminLeadRow> }) {
  if (data.items.length === 0) {
    return (
      <EmptyState
        title="No leads yet"
        hint="Nobody has requested a report by email or Telegram."
      />
    );
  }

  return (
    <div className="space-y-4">
      <AdminTable
        minWidth={920}
        head={
          <>
            <th className="px-5 py-3 font-medium">Created</th>
            <th className="px-5 py-3 font-medium">Email</th>
            <th className="px-5 py-3 font-medium">Telegram</th>
            <th className="px-5 py-3 font-medium">Email status</th>
            <th className="px-5 py-3 font-medium">Telegram status</th>
            <th className="px-5 py-3 font-medium">Error</th>
            <th className="px-5 py-3 font-medium">Report</th>
          </>
        }
      >
        {data.items.map((row) => (
          <AdminRow key={row.id}>
            <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-muted-foreground">
              {formatDateTime(row.createdAt)}
            </td>
            <td className="px-5 py-3.5">
              {row.email ? (
                <span className="text-foreground">{row.email}</span>
              ) : (
                <Dash />
              )}
            </td>
            <td className="px-5 py-3.5">
              {row.telegramHandle ? (
                <span className="text-foreground">{row.telegramHandle}</span>
              ) : (
                <Dash />
              )}
            </td>
            <td className="px-5 py-3.5">
              <DeliveryPill status={row.emailStatus} />
            </td>
            <td className="px-5 py-3.5">
              <DeliveryPill status={row.telegramStatus} />
            </td>
            <td className="px-5 py-3.5">
              <ErrorCode code={row.errorCode} />
            </td>
            <td className="px-5 py-3.5">
              {row.requestId ? (
                <Link
                  href={`/analyses/${row.requestId}`}
                  className="inline-flex items-center gap-1 text-xs text-secondary-foreground transition-colors group-hover:text-accent-hover"
                >
                  @{row.kolHandle} → @{row.orgHandle}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Dash />
              )}
            </td>
          </AdminRow>
        ))}
      </AdminTable>

      {data.nextCursor && (
        <div className="flex justify-center">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/leads?cursor=${data.nextCursor}`}>Load more</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
