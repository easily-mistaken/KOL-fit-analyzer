import { NextResponse } from "next/server";

import {
  LimitRaiseRequestInputSchema,
  nextLimitTier,
  resolveTierLimits,
  err,
  ok,
  type ApiResponse,
} from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

import { getCurrentUser } from "@/lib/auth";
import { buildLimitRaiseNotification, notifyOperator } from "@/lib/notify";
import { ensureOwnerId } from "@/lib/owner";
import { getUserAnalysisLimit } from "@/lib/tier-gate";

// Self-serve allowance-raise requests (Unit 47). Signed-in only: a raised
// allowance is stored on the User and must not be resettable by clearing
// cookies. The operator approves from /admin/upgrades, which writes the new
// User.analysisLimit; nothing here grants anything automatically.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const parsed = LimitRaiseRequestInputSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return json(
      err("validation_error", first?.message ?? "Please check the form."),
      400
    );
  }
  const input = parsed.data;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return json(
        err("unauthorized", "Sign in with Google to request more analyses."),
        401
      );
    }
    // Signed-in owner id == user id, so the raise attaches to a durable account.
    const ownerId = await ensureOwnerId();

    const base = resolveTierLimits(process.env);
    const currentLimit = await getUserAnalysisLimit(ownerId, base.userLifetime);
    const requestedLimit = nextLimitTier(currentLimit);
    if (requestedLimit === null) {
      return json(
        err(
          "conflict",
          "You're already at the highest self-serve tier. For more, request a curated report."
        ),
        409
      );
    }

    // One pending request at a time — a queue of duplicates helps no one.
    const pending = await prisma.limitRaiseRequest.findFirst({
      where: { ownerId, status: "PENDING" },
      select: { id: true },
    });
    if (pending) {
      return json(
        err(
          "conflict",
          "You already have a request in review — we'll get back to you shortly."
        ),
        409
      );
    }

    const created = await prisma.limitRaiseRequest.create({
      data: {
        ownerId,
        userId: user.id,
        email: user.email ?? null,
        currentLimit,
        requestedLimit,
        contactTelegram: input.contactTelegram ?? null,
        contactEmail: input.contactEmail ?? null,
        contactOtherLabel: input.contactOtherLabel ?? null,
        contactOtherValue: input.contactOtherValue ?? null,
        note: input.note ?? null,
      },
      select: { id: true },
    });

    // Ping the operator — best-effort, never blocks the response.
    void notifyOperator(
      buildLimitRaiseNotification({
        email: user.email,
        currentLimit,
        requestedLimit,
        contactTelegram: input.contactTelegram,
        contactEmail: input.contactEmail,
        contactOtherLabel: input.contactOtherLabel,
        contactOtherValue: input.contactOtherValue,
        note: input.note,
      })
    );

    return json(ok({ id: created.id, requestedLimit }), 201);
  } catch {
    return json(
      err("internal_error", "Could not save your request. Please try again."),
      500
    );
  }
}
