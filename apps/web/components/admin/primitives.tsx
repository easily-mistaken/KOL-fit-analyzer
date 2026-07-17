import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import type { JobStatus } from "@kol-fit/shared";

import { cn } from "@/lib/utils";

// Shared, server-safe building blocks for the four admin pages: formatters, the
// table shell, status pills and the empty/not-configured notices. Kept in one
// module so every admin table renders identically.

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DATE_FMT.format(d);
}

export function formatInt(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-US") : "—";
}

/** Provider costs are small: show enough decimals for a single call to be visible. */
export function formatUsd(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `$${n.toFixed(n > 0 && n < 0.01 ? 4 : 2)}`;
}

export function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

/** Owner cookies are long opaque ids; show a stub, keep the full value hoverable. */
export function OwnerId({ id }: { id: string | null }) {
  if (!id) return <Dash />;
  return (
    <span title={id} className="font-mono text-xs text-muted-foreground">
      {id.slice(0, 8)}
    </span>
  );
}

const JOB_STATUS: Record<
  JobStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  QUEUED: { label: "Queued", className: "text-info", icon: <Clock className="h-3.5 w-3.5" /> },
  RUNNING: { label: "Running", className: "text-info", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  COMPLETED: { label: "Completed", className: "text-success", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  FAILED: { label: "Failed", className: "text-error", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

export function JobStatusPill({ status }: { status: JobStatus | null }) {
  if (!status) return <Dash />;
  const s = JOB_STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px]", s.className)}>
      {s.icon}
      {s.label}
    </span>
  );
}

export function ErrorCode({ code }: { code: string | null }) {
  if (!code) return <Dash />;
  return <span className="font-mono text-xs text-error">{code}</span>;
}

/** Card-framed, horizontally scrollable table — matches the reports list. */
export function AdminTable({
  head,
  minWidth = 720,
  children,
}: {
  head: React.ReactNode;
  minWidth?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-default bg-surface shadow-card">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-default text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            {head}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function AdminRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="group border-b border-default/50 transition-colors last:border-b-0 hover:bg-elevated">
      {children}
    </tr>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-default bg-surface px-6 py-16 text-center">
      <span className="grid h-12 w-12 place-content-center rounded-xl bg-elevated text-muted-foreground">
        <Inbox className="h-5 w-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/**
 * Fail-closed notice: without ADMIN_PASSWORD the panel is disabled entirely, so
 * every admin route (login included) renders this instead of any real UI.
 */
export function NotConfigured() {
  return (
    <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-default bg-surface px-6 py-14 text-center shadow-card">
      <span className="mx-auto grid h-12 w-12 place-content-center rounded-xl bg-elevated text-muted-foreground">
        <ShieldAlert className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">
        Admin panel is not configured
      </p>
      <p className="text-sm text-muted-foreground">
        Set <span className="font-mono text-secondary-foreground">ADMIN_PASSWORD</span>{" "}
        in the environment to enable it.
      </p>
    </div>
  );
}
