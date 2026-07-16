import { NextResponse } from "next/server";

import {
  DetailedReportRequestInputSchema,
  err,
  ok,
  type ApiResponse,
} from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

import { getCurrentUser } from "@/lib/auth";
import { ensureOwnerId } from "@/lib/owner";

// Detailed-report concierge requests (Unit 35). Public: anyone may raise a
// request at any time (this is the alternative path to the self-serve run).
// Light per-owner cap prevents spam; fulfillment is manual via the admin panel.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DAILY_CAP = 3;

function dailyCap(): number {
  const n = Number(process.env.MAX_DETAILED_REQUESTS_PER_OWNER_PER_DAY);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : DEFAULT_DAILY_CAP;
}

function json<T>(body: ApiResponse<T>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(err("validation_error", "Invalid JSON body."), 400);
  }

  const parsed = DetailedReportRequestInputSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return json(
      err("validation_error", first?.message ?? "Invalid request."),
      400
    );
  }
  const input = parsed.data;

  try {
    const ownerId = await ensureOwnerId();
    const user = await getCurrentUser();

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await prisma.detailedReportRequest.count({
      where: { ownerId, createdAt: { gte: since } },
    });
    if (recent >= dailyCap()) {
      return json(
        err(
          "rate_limited",
          "You already have recent detailed-report requests in the queue. We'll be in touch on Telegram soon."
        ),
        429
      );
    }

    const created = await prisma.detailedReportRequest.create({
      data: {
        ownerId,
        userId: user?.id ?? null,
        analysisRequestId: input.analysisRequestId ?? null,
        orgHandle: input.orgHandle ?? null,
        kolHandle: input.kolHandle ?? null,
        telegram: input.telegram,
        xHandle: input.xHandle,
        note: input.note ?? null,
      },
      select: { id: true, createdAt: true },
    });

    return json(ok({ id: created.id, createdAt: created.createdAt.toISOString() }), 201);
  } catch {
    return json(
      err("internal_error", "Could not save your request. Please try again."),
      500
    );
  }
}
