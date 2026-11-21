import { Lightbulb } from "lucide-react";

import { prisma } from "@kol-fit/db";
import {
  IDEA_BUDGETS,
  IDEA_STYLES,
  ideaContactLabel,
  type IdeaBudget,
  type IdeaContactChannel,
  type IdeaStyle,
} from "@kol-fit/shared/video-idea-options";

import { isAdminConfigured, requireAdmin } from "@/lib/admin/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminRow, AdminTable, Dash, EmptyState, NotConfigured, formatDateTime } from "@/components/admin/primitives";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTACT_LINK: Record<string, (v: string) => string> = {
  email: (v) => `mailto:${v}`,
  x: (v) => `https://x.com/${v}`,
  telegram: (v) => `https://t.me/${v}`,
};

/** Free video idea requests from the agency site (Unit 57), newest first. */
export default async function AdminVideoIdeasPage() {
  if (!isAdminConfigured()) return <NotConfigured />;
  await requireAdmin();

  const rows = await prisma.videoIdeaRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  // Opening the queue marks what it shows as seen (clears the nav badge).
  const unseen = rows.filter((r) => !r.seenAt).map((r) => r.id);
  if (unseen.length > 0) {
    await prisma.videoIdeaRequest
      .updateMany({ where: { id: { in: unseen } }, data: { seenAt: new Date() } })
      .catch(() => {});
  }

  return (
    <div className="space-y-8">
      <AdminNav />

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lightbulb className="h-5 w-5 text-accent-ink" />
          <span>Video ideas</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Free video idea requests</h1>
        <p className="max-w-2xl text-sm text-secondary-foreground">
          From the form at /free-video-idea. Send each one an idea on the channel they picked.
        </p>
      </section>

      {rows.length === 0 ? (
        <EmptyState title="No requests yet" hint="They appear here, and on Telegram, as soon as someone sends the form." />
      ) : (
        <AdminTable
          minWidth={980}
          head={
            <>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Launching</th>
              <th className="px-4 py-3 font-medium">Budget</th>
              <th className="px-4 py-3 font-medium">Style</th>
              <th className="px-4 py-3 font-medium">Send to</th>
              <th className="px-4 py-3 font-medium">Links</th>
              <th className="px-4 py-3 font-medium">From</th>
            </>
          }
        >
          {rows.map((r) => (
            <AdminRow key={r.id}>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {formatDateTime(r.createdAt.toISOString())}
                {r.seenAt ? null : <span className="ml-2 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground">new</span>}
              </td>
              <td className="max-w-sm px-4 py-3 text-foreground">{r.brief}</td>
              <td className="whitespace-nowrap px-4 py-3">{IDEA_BUDGETS[r.budget as IdeaBudget] ?? r.budget}</td>
              <td className="whitespace-nowrap px-4 py-3">{r.style ? (IDEA_STYLES[r.style as IdeaStyle] ?? r.style) : <Dash />}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <a
                  href={(CONTACT_LINK[r.contactChannel] ?? CONTACT_LINK.email)(r.contactValue)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-ink hover:underline"
                >
                  {ideaContactLabel(r.contactChannel as IdeaContactChannel, r.contactValue)}
                </a>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  {r.productUrl ? (
                    <a href={r.productUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-ink hover:underline">
                      Product
                    </a>
                  ) : null}
                  {r.referenceUrl ? (
                    <a href={r.referenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-ink hover:underline">
                      Reference
                    </a>
                  ) : null}
                  {!r.productUrl && !r.referenceUrl ? <Dash /> : null}
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{r.source}</td>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
