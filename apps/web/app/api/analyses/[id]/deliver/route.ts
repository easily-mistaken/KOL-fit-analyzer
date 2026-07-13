import {
  err,
  ok,
  ReportDeliverInputSchema,
  type ApiResponse,
} from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";
import { enqueueReportDeliver } from "@kol-fit/queue";

import { getOwnerId } from "@/lib/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeliverResult = {
  id: string;
  emailQueued: boolean;
  telegramCaptured: boolean;
};

function json(body: ApiResponse<DeliverResult>, status: number): Response {
  return Response.json(body, { status });
}

/**
 * POST /api/analyses/[id]/deliver
 *
 * Captures a lead (email and/or Telegram) for a completed report and — for
 * email — queues a job that renders the report PDF and emails it. Telegram is
 * stored now; delivery there is deferred. Thin: no rendering here.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(err("validation_error", "Invalid JSON body"), 400);
  }
  const parsed = ReportDeliverInputSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      err("validation_error", parsed.error.issues[0]?.message ?? "Invalid input."),
      400
    );
  }
  const { email, telegramHandle } = parsed.data;

  try {
    const request = await prisma.analysisRequest.findUnique({
      where: { id },
      include: { report: true },
    });
    if (!request || !request.report) {
      return json(err("not_found", "Report not found."), 404);
    }
    // Only the owner may deliver their own report.
    const ownerId = await getOwnerId();
    if (!request.ownerId || request.ownerId !== ownerId) {
      return json(err("not_found", "Report not found."), 404);
    }
    if (request.report.status !== "COMPLETED") {
      return json(err("conflict", "The report is not ready yet."), 409);
    }

    const delivery = await prisma.reportDelivery.create({
      data: {
        reportId: request.report.id,
        requestId: request.id,
        workspaceId: request.workspaceId,
        email: email ?? null,
        telegramHandle: telegramHandle ?? null,
        emailStatus: email ? "PENDING" : "SKIPPED",
        telegramStatus: telegramHandle ? "SKIPPED" : "SKIPPED", // captured; delivery deferred
      },
    });

    let emailQueued = false;
    if (email) {
      try {
        await enqueueReportDeliver({ deliveryId: delivery.id });
        emailQueued = true;
      } catch (enqueueError) {
        console.error("[POST deliver] enqueue failed:", enqueueError);
        await prisma.reportDelivery
          .update({
            where: { id: delivery.id },
            data: {
              emailStatus: "FAILED",
              errorCode: "enqueue_failed",
            },
          })
          .catch(() => {});
      }
    }

    return json(
      ok({
        id: delivery.id,
        emailQueued,
        telegramCaptured: Boolean(telegramHandle),
      }),
      201
    );
  } catch (error) {
    console.error(`[POST /api/analyses/${id}/deliver] failed:`, error);
    return json(err("internal_error", "Couldn't process your request."), 500);
  }
}
