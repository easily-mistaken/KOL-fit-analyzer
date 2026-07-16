"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AdminDetailedRequestRow, Page } from "@/lib/admin/types";
import {
  AdminRow,
  AdminTable,
  Dash,
  EmptyState,
  formatDateTime,
} from "@/components/admin/primitives";

// Concierge queue (Unit 35). Fulfillment is manual: the operator DMs the
// curated report on Telegram, then flips the status here.

const STATUS_TONE: Record<AdminDetailedRequestRow["status"], string> = {
  NEW: "border-accent/50 bg-accent/10 text-accent-hover",
  SENT: "border-success/50 bg-success/10 text-success",
  DISMISSED: "border-default bg-elevated text-muted-foreground",
};

export function AdminDetailedRequestsTable({
  data,
}: {
  data: Page<AdminDetailedRequestRow>;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function setStatus(id: string, status: "SENT" | "DISMISSED" | "NEW") {
    setBusyId(id);
    try {
      await fetch("/api/admin/detailed-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        title="No detailed-report requests yet"
        hint="Requests raised from the report pages, the analysis form, or the tier wall land here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <AdminTable
        head={["Requested", "Pair", "Telegram", "X", "Email", "Note", "Status", "Actions"]}
      >
        {data.items.map((r) => (
          <AdminRow key={r.id}>
            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
              {formatDateTime(r.createdAt)}
            </td>
            <td className="px-3 py-2.5 text-sm">
              {r.orgHandle || r.kolHandle ? (
                <span>
                  {r.orgHandle ? `@${r.orgHandle}` : "—"}{" "}
                  <span className="text-muted-foreground">×</span>{" "}
                  {r.kolHandle ? `@${r.kolHandle}` : "—"}
                </span>
              ) : (
                <Dash />
              )}
              {r.analysisRequestId && (
                <Link
                  href={`/analyses/${r.analysisRequestId}`}
                  className="ml-2 inline-flex items-center gap-0.5 text-xs text-accent-hover hover:underline"
                >
                  report <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-sm">
              <a
                href={`https://t.me/${r.telegram}`}
                target="_blank"
                rel="noreferrer"
                className="text-accent-hover hover:underline"
              >
                @{r.telegram}
              </a>
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-sm">
              <a
                href={`https://x.com/${r.xHandle}`}
                target="_blank"
                rel="noreferrer"
                className="text-accent-hover hover:underline"
              >
                @{r.xHandle}
              </a>
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-secondary-foreground">
              {r.email ?? <Dash />}
            </td>
            <td className="max-w-[220px] px-3 py-2.5 text-xs text-secondary-foreground">
              {r.note ? <span className="line-clamp-2">{r.note}</span> : <Dash />}
            </td>
            <td className="whitespace-nowrap px-3 py-2.5">
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[r.status]}`}
              >
                {r.status}
              </span>
            </td>
            <td className="whitespace-nowrap px-3 py-2.5">
              {r.status === "NEW" ? (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === r.id}
                    onClick={() => setStatus(r.id, "SENT")}
                  >
                    <Check className="h-3.5 w-3.5" /> Sent
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === r.id}
                    onClick={() => setStatus(r.id, "DISMISSED")}
                  >
                    <X className="h-3.5 w-3.5" /> Dismiss
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === r.id}
                  onClick={() => setStatus(r.id, "NEW")}
                >
                  Reopen
                </Button>
              )}
            </td>
          </AdminRow>
        ))}
      </AdminTable>

      {data.nextCursor && (
        <div className="flex justify-center">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/detailed?cursor=${data.nextCursor}`}>
              Load more
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
