import { NextResponse } from "next/server";

import { err, ok, type ApiResponse } from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

import { isAdminRequest } from "@/lib/admin/auth";

// Operator decisions on allowance-raise requests (Unit 47). Approving raises the
// user's stored allowance (User.analysisLimit) so it takes effect on their very
// next analysis; declining just records the outcome. Idempotent: acting on an
// already-decided request is a no-op that returns its current state.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "approve" | "decline";
const ACTIONS = new Set<Action>(["approve", "decline"]);

function parsePatch(body: unknown): { id: string; action: Action } | null {
  if (!body || typeof body !== "object") return null;
  const { id, action } = body as Record<string, unknown>;
  if (typeof id !== "string" || id.length < 10 || id.length > 40) return null;
  if (typeof action !== "string" || !ACTIONS.has(action as Action)) return null;
  return { id, action: action as Action };
}

function json<T>(body: ApiResponse<T>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

/** Unread badge: chat-style — counts requests the operator hasn't seen yet.
 *  Viewing the queue marks them seen. */
export async function GET(): Promise<NextResponse> {
  if (!(await isAdminRequest())) {
    return json(err("unauthorized", "Admin session required."), 401);
  }
  try {
    const newCount = await prisma.limitRaiseRequest.count({
      where: { seenAt: null, status: "PENDING" },
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
    return json(err("validation_error", "Invalid id or action."), 400);
  }

  try {
    const existing = await prisma.limitRaiseRequest.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        status: true,
        userId: true,
        ownerId: true,
        requestedLimit: true,
      },
    });
    if (!existing) {
      return json(err("not_found", "Request not found."), 404);
    }
    // Idempotent: only a PENDING request can transition.
    if (existing.status !== "PENDING") {
      return json(ok({ id: existing.id, status: existing.status }), 200);
    }

    if (parsed.action === "decline") {
      const updated = await prisma.limitRaiseRequest.update({
        where: { id: existing.id },
        data: { status: "DECLINED", decidedAt: new Date() },
        select: { id: true, status: true },
      });
      return json(ok(updated), 200);
    }

    // Approve: raise the user's allowance and mark the request approved together.
    const userId = existing.userId ?? existing.ownerId;
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { analysisLimit: true },
      });
      // Only ever raise, never lower — a stale, lower request must not cut an
      // allowance that's since been raised further.
      const newLimit = Math.max(existing.requestedLimit, user?.analysisLimit ?? 0);
      if (user) {
        await tx.user.update({
          where: { id: userId },
          data: { analysisLimit: newLimit },
        });
      }
      const req = await tx.limitRaiseRequest.update({
        where: { id: existing.id },
        data: { status: "APPROVED", decidedAt: new Date() },
        select: { id: true, status: true },
      });
      return { req, granted: Boolean(user), newLimit };
    });

    return json(
      ok({
        id: result.req.id,
        status: result.req.status,
        granted: result.granted,
        newLimit: result.newLimit,
      }),
      200
    );
  } catch {
    return json(err("internal_error", "Could not update the request."), 500);
  }
}
