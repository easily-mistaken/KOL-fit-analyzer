import { NextResponse } from "next/server";

import { err, ok, type ApiResponse } from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

import { isAdminRequest } from "@/lib/admin/auth";

// Admin status transitions for detailed-report requests (Unit 35). Fulfillment
// itself is manual (operator DMs the curated report on Telegram); this only
// records the outcome.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["NEW", "SENT", "DISMISSED"] as const);
type Status = "NEW" | "SENT" | "DISMISSED";

function parsePatch(body: unknown): { id: string; status: Status } | null {
  if (!body || typeof body !== "object") return null;
  const { id, status } = body as Record<string, unknown>;
  if (typeof id !== "string" || id.length < 10 || id.length > 40) return null;
  if (typeof status !== "string" || !STATUSES.has(status as Status)) return null;
  return { id, status: status as Status };
}

function json<T>(body: ApiResponse<T>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

/** Unread badge (Unit 40.1): chat-style — counts UNSEEN requests. Viewing the
 *  leads queue marks everything seen; workflow status is independent. */
export async function GET(): Promise<NextResponse> {
  if (!(await isAdminRequest())) {
    return json(err("unauthorized", "Admin session required."), 401);
  }
  try {
    const newCount = await prisma.detailedReportRequest.count({
      where: { seenAt: null },
    });
    return json(ok({ newCount }), 200);
  } catch {
    return json(err("internal_error", "Could not load counts."), 500);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  if (!(await isAdminRequest())) {
    return json(err("unauthorized", "Admin session required."), 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(err("validation_error", "Invalid JSON body."), 400);
  }
  const parsed = parsePatch(body);
  if (!parsed) {
    return json(err("validation_error", "Invalid id or status."), 400);
  }

  try {
    const updated = await prisma.detailedReportRequest.update({
      where: { id: parsed.id },
      data: {
        status: parsed.status,
        fulfilledAt: parsed.status === "SENT" ? new Date() : null,
      },
      select: { id: true, status: true },
    });
    return json(ok(updated), 200);
  } catch {
    return json(err("not_found", "Request not found."), 404);
  }
}
