import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AdminUsage } from "@/lib/admin/types";
import {
  AdminRow,
  AdminTable,
  Dash,
  EmptyState,
  formatDateTime,
  formatInt,
  formatUsd,
} from "@/components/admin/primitives";

/** Provider spend: all-time totals per provider, then the recent raw log rows. */
export function AdminUsageTables({ usage }: { usage: AdminUsage }) {
  if (usage.totals.length === 0 && usage.rows.items.length === 0) {
    return (
      <EmptyState
        title="No provider usage yet"
        hint="Provider calls are logged here once an analysis runs."
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Totals by provider</h2>
        <AdminTable
          minWidth={640}
          head={
            <>
              <th className="px-5 py-3 font-medium">Provider</th>
              <th className="px-5 py-3 text-right font-medium">Calls</th>
              <th className="px-5 py-3 text-right font-medium">Requests</th>
              <th className="px-5 py-3 text-right font-medium">Tokens in</th>
              <th className="px-5 py-3 text-right font-medium">Tokens out</th>
              <th className="px-5 py-3 text-right font-medium">Cost</th>
            </>
          }
        >
          {usage.totals.map((t) => (
            <AdminRow key={t.provider}>
              <td className="px-5 py-3.5 font-medium text-foreground">{t.provider}</td>
              <td className="px-5 py-3.5 text-right font-mono text-xs text-secondary-foreground">
                {formatInt(t.calls)}
              </td>
              <td className="px-5 py-3.5 text-right font-mono text-xs text-secondary-foreground">
                {formatInt(t.requests)}
              </td>
              <td className="px-5 py-3.5 text-right font-mono text-xs text-secondary-foreground">
                {formatInt(t.tokensIn)}
              </td>
              <td className="px-5 py-3.5 text-right font-mono text-xs text-secondary-foreground">
                {formatInt(t.tokensOut)}
              </td>
              <td className="px-5 py-3.5 text-right font-mono text-[13px] font-semibold text-foreground">
                {formatUsd(t.costUsd)}
              </td>
            </AdminRow>
          ))}
        </AdminTable>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Recent calls</h2>
        {usage.rows.items.length === 0 ? (
          <EmptyState title="No recent calls" hint="Nothing logged in this window." />
        ) : (
          <div className="space-y-4">
            <AdminTable
              minWidth={860}
              head={
                <>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Provider</th>
                  <th className="px-5 py-3 font-medium">Operation</th>
                  <th className="px-5 py-3 text-right font-medium">Requests</th>
                  <th className="px-5 py-3 text-right font-medium">Tokens in</th>
                  <th className="px-5 py-3 text-right font-medium">Tokens out</th>
                  <th className="px-5 py-3 text-right font-medium">Cost</th>
                  <th className="px-5 py-3 font-medium">Analysis</th>
                </>
              }
            >
              {usage.rows.items.map((row) => (
                <AdminRow key={row.id}>
                  <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-5 py-3.5 text-foreground">{row.provider}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-secondary-foreground">
                    {row.operation}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-secondary-foreground">
                    {formatInt(row.requests)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-secondary-foreground">
                    {formatInt(row.tokensIn)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-secondary-foreground">
                    {formatInt(row.tokensOut)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-foreground">
                    {formatUsd(row.costUsd)}
                  </td>
                  <td className="px-5 py-3.5">
                    {row.requestId ? (
                      <Link
                        href={`/analyses/${row.requestId}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-accent-ink"
                      >
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <Dash />
                    )}
                  </td>
                </AdminRow>
              ))}
            </AdminTable>

            {usage.rows.nextCursor && (
              <div className="flex justify-center">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/usage?cursor=${usage.rows.nextCursor}`}>
                    Load more
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
