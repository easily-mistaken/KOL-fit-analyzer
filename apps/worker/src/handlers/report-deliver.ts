import { prisma } from "@kol-fit/db";
import { createMailProvider } from "@kol-fit/mail";
import { ReportDeliverPayloadSchema } from "@kol-fit/queue";
import { FitReportSchema, ScoreBreakdownSchema } from "@kol-fit/shared";

/**
 * Processes one `report.deliver` job: renders the report PDF and emails it to
 * the captured address, updating the ReportDelivery row. Best-effort and
 * isolated — a failure marks the row FAILED (the lead is preserved) and is
 * ack'd so it can't sink the batch. Idempotent (a SENT row short-circuits).
 */
export async function processReportDelivery(
  rawData: unknown,
  pgJobId: string
): Promise<void> {
  const parsed = ReportDeliverPayloadSchema.safeParse(rawData);
  if (!parsed.success) {
    console.warn(
      `[worker] invalid report.deliver payload (pg-boss job ${pgJobId}); acking.`,
      parsed.error.issues
    );
    return;
  }
  const { deliveryId } = parsed.data;

  const delivery = await prisma.reportDelivery.findUnique({
    where: { id: deliveryId },
    include: { report: { include: { request: true } } },
  });
  if (!delivery) {
    console.warn(`[worker] ReportDelivery ${deliveryId} not found; acking.`);
    return;
  }
  if (delivery.emailStatus === "SENT") {
    console.log(`[worker] ReportDelivery ${deliveryId} already sent; skipping.`);
    return;
  }
  if (!delivery.email) {
    return; // no email channel — nothing to send (should not be enqueued)
  }

  try {
    const report = delivery.report;
    if (!report?.report) {
      throw new Error("report unavailable");
    }
    const fitReport = FitReportSchema.parse(report.report);
    const scoresParsed = report.scores
      ? ScoreBreakdownSchema.safeParse(report.scores)
      : null;
    const scores = scoresParsed?.success ? scoresParsed.data : null;

    const org = report.request?.orgHandle ?? "org";
    const kol = report.request?.kolHandle ?? "kol";

    // report-pdf is ESM-only; load it via dynamic import from this CJS worker.
    const { renderReportPdf } = await import("@kol-fit/report-pdf");
    const pdf = await renderReportPdf({
      fitReport,
      scores,
      meta: {
        orgHandle: org,
        kolHandle: kol,
        generatedAt: report.generatedAt?.toISOString() ?? null,
      },
    });

    const mail = await createMailProvider();
    const safeName = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    await mail.send({
      to: delivery.email,
      subject: `Your KOL fit report — @${org} vs @${kol}`,
      text: `Attached is your engaged-audience fit report for @${org} vs @${kol}.\n\nVerdict: ${fitReport.verdict} (${fitReport.overallScore.value}/100).`,
      html:
        `<p>Attached is your engaged-audience fit report for <b>@${org}</b> vs <b>@${kol}</b>.</p>` +
        `<p>Verdict: <b>${fitReport.verdict}</b> (${fitReport.overallScore.value}/100).</p>` +
        `<p>— KOL Fit Analyzer</p>`,
      attachments: [
        {
          filename: `kol-fit-${safeName(org)}-${safeName(kol)}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });

    await prisma.reportDelivery.update({
      where: { id: deliveryId },
      data: { emailStatus: "SENT", sentAt: new Date() },
    });
    console.log(
      `[worker] report.deliver sent for delivery ${deliveryId} (${pdf.length} bytes).`
    );
  } catch (error) {
    console.error(
      `[worker] report.deliver failed for delivery ${deliveryId}:`,
      error instanceof Error ? error.message : String(error)
    );
    try {
      await prisma.reportDelivery.update({
        where: { id: deliveryId },
        data: {
          emailStatus: "FAILED",
          errorCode: "delivery_error",
          errorMessage: "Failed to render or send the report email.",
        },
      });
    } catch (markError) {
      console.error(
        `[worker] failed to mark delivery ${deliveryId} FAILED:`,
        markError
      );
    }
  }
}
