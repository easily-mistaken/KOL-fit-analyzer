import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FitReportSchema, ScoreBreakdownSchema } from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

import { FitReportView } from "@/components/report/fit-report-view";

// Public shared-report page (Unit 38). Access is the capability token alone —
// unguessable, owner-revocable. Read-only, noindex, and a funnel entry: every
// shared report advertises the analyzer.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared fit report",
  robots: { index: false, follow: false },
};

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const report = await prisma.report.findUnique({
    where: { shareToken: token },
    include: { request: true },
  });
  if (!report || report.status !== "COMPLETED" || !report.request) notFound();

  const fitParsed = FitReportSchema.safeParse(report.report);
  if (!fitParsed.success) notFound();
  const scoresParsed = ScoreBreakdownSchema.safeParse(report.scores);

  return (
    <div className="space-y-6">
      {/* Brand banner — the shared page is a funnel entry. */}
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-5 py-4">
        <div className="flex items-center gap-2.5 text-sm">
          <span className="h-2 w-2 shrink-0 rounded-[2px] bg-accent-primary" />
          <span className="text-secondary-foreground">
            This report was shared with you. We measure who actually listens,
            not who follows.
          </span>
        </div>
        <Link
          href="/"
          className="inline-flex shrink-0 items-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Analyze a creator
        </Link>
      </div>

      <FitReportView
        fitReport={fitParsed.data}
        scores={scoresParsed.success ? scoresParsed.data : null}
        meta={{
          orgHandle: report.request.orgHandle,
          kolHandle: report.request.kolHandle,
          requestId: report.request.id,
          generatedAt: report.generatedAt ? report.generatedAt.toISOString() : null,
        }}
        mode="public"
      />
    </div>
  );
}
