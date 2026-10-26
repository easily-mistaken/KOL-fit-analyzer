import { NextResponse } from "next/server";

import {
  LEAD_SOURCE_LABELS,
  LeadCaptureInputSchema,
  err,
  ok,
  type ApiResponse,
} from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

import { getCurrentUser } from "@/lib/auth";
import { buildLeadNotification, notifyOperator } from "@/lib/notify";
import { ensureOwnerId, ownedAnalysisId } from "@/lib/owner";

// Lightweight email capture (Unit 44). Public and deliberately low-friction:
// one field, no account, at the moment a reader has just been handed value.
// Fulfilment is manual — see the copy note in <EmailCapture>.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DAILY_CAP = 5;

function dailyCap(): number {
  const n = Number(process.env.MAX_LEADS_PER_OWNER_PER_DAY);
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

  const parsed = LeadCaptureInputSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return json(err("validation_error", first?.message ?? "Invalid request."), 400);
  }
  const input = parsed.data;

  try {
    const ownerId = await ensureOwnerId();
    const user = await getCurrentUser();
    // A signed-in reader's account email wins over anything typed: it is the
    // verified one, and it keeps this row joinable to their User in /admin/people.
    const email = user?.email ?? input.email;

    // Per-browser cap. Counts DISTINCT rows this owner created today rather
    // than submissions, so re-submitting the same address (a double-click, or
    // correcting a typo) can never lock someone out of their own capture.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await prisma.lead.count({
      where: { ownerId, createdAt: { gte: since } },
    });
    const existing = await prisma.lead.findUnique({
      where: { email },
      select: { id: true, updatedAt: true },
    });
    if (!existing && recent >= dailyCap()) {
      return json(
        err("rate_limited", "That's enough emails from this browser for today."),
        429
      );
    }

    const analysisRequestId = await ownedAnalysisId(input.analysisRequestId, ownerId);

    // Upsert: one row per person. A returning capture refreshes the hook
    // (what they were looking at) without duplicating them in the outreach
    // list, and never overwrites `firstSource` (where someone was FIRST caught
    // is the durable intent signal) or `ownerId`: the email is typed by the
    // client, so overwriting the owner would let anyone who knows an address
    // move that person's analyses to their own browser in /admin/people.
    await prisma.lead.upsert({
      where: { email },
      create: {
        email,
        ownerId,
        firstSource: input.source,
        analysisRequestId,
        orgHandle: input.orgHandle ?? null,
        kolHandle: input.kolHandle ?? null,
        note: input.note ?? null,
      },
      update: {
        analysisRequestId: analysisRequestId ?? undefined,
        orgHandle: input.orgHandle ?? undefined,
        kolHandle: input.kolHandle ?? undefined,
        note: input.note ?? undefined,
        // Re-opening the loop: a returning lead is worth looking at again.
        seenAt: null,
      },
    });

    // Best-effort operator ping; never fails the user's request. A returning
    // email skips the daily cap above (so nobody is locked out of their own
    // capture), which would also make it an unlimited Telegram trigger; ping
    // for it at most once a day.
    const pingedRecently =
      existing !== null &&
      Date.now() - existing.updatedAt.getTime() < 24 * 60 * 60 * 1000;
    if (!pingedRecently) {
      void notifyOperator(
        buildLeadNotification({
          email,
          source: LEAD_SOURCE_LABELS[input.source] ?? input.source,
          orgHandle: input.orgHandle,
          kolHandle: input.kolHandle,
          returning: Boolean(existing),
        })
      );
    }

    return json(ok({ captured: true }), 201);
  } catch {
    return json(err("internal_error", "Could not save that right now."), 500);
  }
}
