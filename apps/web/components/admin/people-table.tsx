import type { AdminPersonRow } from "@/lib/admin/types";

import { EmptyState } from "@/components/admin/primitives";

// Read-only CRM table (Unit 44). One row per human; see getAdminPeople for how
// the three source tables are merged.

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Coarse recency — an operator scans "who is warm", not exact timestamps. */
function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function Tag({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent" | "success";
}) {
  const tones = {
    muted: "border-default text-muted-foreground",
    accent: "border-accent-ink/40 text-accent-ink",
    success: "border-success/40 text-success",
  } as const;
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-px text-[10px] uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function AdminPeopleTable({ rows }: { rows: AdminPersonRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nobody yet"
        hint="People land here when someone signs in with Google, leaves an email on a finished report, or asks for a detailed report."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-default">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-default bg-elevated text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-medium">Email</th>
            <th className="px-3 py-2.5 font-medium">How we got them</th>
            <th className="px-3 py-2.5 text-right font-medium">Analyses</th>
            <th className="px-3 py-2.5 font-medium">Last looked at</th>
            <th className="px-3 py-2.5 font-medium">First seen</th>
            <th className="px-3 py-2.5 font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.email}
              className="border-b border-default/60 last:border-0 hover:bg-elevated/60"
            >
              <td className="px-3 py-2.5">
                <a
                  href={`mailto:${p.email}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {p.email}
                </a>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.hasAccount && <Tag tone="accent">account</Tag>}
                  {p.isLead && <Tag>email</Tag>}
                  {p.requestedDetailed && <Tag tone="success">wants detailed</Tag>}
                  {p.firstSource && (
                    <span className="text-[11.5px] text-muted-foreground">
                      {p.firstSource}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-[13px] text-foreground">
                {p.analyses}
              </td>
              <td className="px-3 py-2.5 text-[12.5px] text-secondary-foreground">
                {p.lastPair ? (
                  <>
                    @{p.lastPair.orgHandle ?? "?"}{" "}
                    <span className="text-muted-foreground">×</span> @
                    {p.lastPair.kolHandle ?? "?"}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-[12.5px] text-secondary-foreground">
                {fmtDate(p.firstSeen)}
              </td>
              <td className="px-3 py-2.5 text-[12.5px] text-secondary-foreground">
                {ago(p.lastSeen)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
