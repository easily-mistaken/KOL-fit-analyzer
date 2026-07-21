"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AdminLimitRaiseRow, Page } from "@/lib/admin/types";
import {
  AdminRow,
  AdminTable,
  Dash,
  EmptyState,
  formatDateTime,
} from "@/components/admin/primitives";

// Allowance-raise queue (Unit 47). Approving raises the user's stored allowance
// immediately; both decisions are final (no reopen — a granted allowance is
// already in effect and reversing it is a manual DB action, not a table click).

const STATUS_TONE: Record<AdminLimitRaiseRow["status"], string> = {
  PENDING: "border-accent/50 bg-accent/10 text-accent-ink",
  APPROVED: "border-success/50 bg-success/10 text-success",
  DECLINED: "border-default bg-elevated text-muted-foreground",
};

/** One reach-me channel as a link when we can build one, else plain text. */
function Contacts({ r }: { r: AdminLimitRaiseRow }) {
  const items: React.ReactNode[] = [];
  if (r.contactTelegram) {
    items.push(
      <a
        key="tg"
        href={`https://t.me/${r.contactTelegram}`}
        target="_blank"
        rel="noreferrer"
        className="text-accent-ink hover:underline"
      >
        Telegram @{r.contactTelegram}
      </a>
    );
  }
  if (r.contactEmail) {
    items.push(
      <a key="em" href={`mailto:${r.contactEmail}`} className="text-accent-ink hover:underline">
        {r.contactEmail}
      </a>
    );
  }
  if (r.contactOtherLabel && r.contactOtherValue) {
    items.push(
      <span key="ot" className="text-secondary-foreground">
        {r.contactOtherLabel}: {r.contactOtherValue}
      </span>
    );
  }
  if (items.length === 0) return <Dash />;
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {items.map((it, i) => (
        <span key={i}>{it}</span>
      ))}
    </div>
  );
}

export function AdminLimitRequestsTable({
  data,
}: {
  data: Page<AdminLimitRaiseRow>;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function decide(id: string, action: "approve" | "decline") {
    setBusyId(id);
    try {
      await fetch("/api/admin/limit-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        title="No upgrade requests yet"
        hint="When a signed-in user runs out of analyses and asks to unlock more, it lands here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <AdminTable
        minWidth={920}
        head={
          <>
            <th className="px-3 py-3 font-medium">Requested</th>
            <th className="px-3 py-3 font-medium">Wants</th>
            <th className="px-3 py-3 font-medium">Account</th>
            <th className="px-3 py-3 font-medium">Reach them</th>
            <th className="px-3 py-3 font-medium">Note</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium">Actions</th>
          </>
        }
      >
        {data.items.map((r) => (
          <AdminRow key={r.id}>
            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
              {formatDateTime(r.createdAt)}
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-sm">
              <span className="font-mono">
                {r.currentLimit}{" "}
                <ArrowRight className="inline h-3 w-3 text-muted-foreground" />{" "}
                <span className="font-semibold text-foreground">{r.requestedLimit}</span>
              </span>
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-secondary-foreground">
              {r.email ?? <Dash />}
            </td>
            <td className="px-3 py-2.5">
              <Contacts r={r} />
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
              {r.status === "PENDING" ? (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => decide(r.id, "approve")}
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === r.id}
                    onClick={() => decide(r.id, "decline")}
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {r.decidedAt ? formatDateTime(r.decidedAt) : "—"}
                </span>
              )}
            </td>
          </AdminRow>
        ))}
      </AdminTable>

      {data.nextCursor && (
        <div className="flex justify-center">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/upgrades?cursor=${data.nextCursor}`}>Load more</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
