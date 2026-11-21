import { NextResponse } from "next/server";

import {
  IDEA_BUDGETS,
  IDEA_STYLES,
  VideoIdeaInputSchema,
  err,
  ideaContactLabel,
  ok,
  type ApiResponse,
} from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

import { getClientIpHash } from "@/lib/client-ip";
import { buildVideoIdeaNotification, notifyOperator } from "@/lib/notify";
import { ensureOwnerId } from "@/lib/owner";

// "Get a free video idea" (Unit 57). Public, no account: the visitor says what
// they are launching, a budget range and where to send the idea; the operator
// is pinged on Telegram and replies by hand. Mirrors launchgallery.video.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Per browser and per IP per day, and site-wide per hour (bounds the Telegram pings). */
const PER_CLIENT_PER_DAY = 3;
const SITE_PER_HOUR = 40;

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

  // Honeypot: people never see this field. Pretend it worked so bots move on.
  if (body && typeof body === "object" && String((body as Record<string, unknown>).hp_note ?? "").trim() !== "") {
    return json(ok({ contact: "" }), 201);
  }

  const parsed = VideoIdeaInputSchema.safeParse(body);
  if (!parsed.success) {
    // Our messages are worded for people; zod's own defaults ("Invalid
    // input: ...") are not, so those become a generic line.
    const first = parsed.error.issues[0];
    const message = first?.message && !first.message.startsWith("Invalid input") ? first.message : "Please check the form.";
    return json(err("validation_error", message), 400);
  }
  const input = parsed.data;

  try {
    const ownerId = await ensureOwnerId();
    // Null without the trusted proxy header (local dev): then only the cookie
    // and site-wide caps apply.
    const ipHash = await getClientIpHash();
    const now = Date.now();
    const day = new Date(now - 24 * 3600_000);
    const [mine, fromIp, site] = await Promise.all([
      prisma.videoIdeaRequest.count({ where: { ownerId, createdAt: { gte: day } } }),
      ipHash ? prisma.videoIdeaRequest.count({ where: { ipHash, createdAt: { gte: day } } }) : Promise.resolve(0),
      prisma.videoIdeaRequest.count({ where: { createdAt: { gte: new Date(now - 3600_000) } } }),
    ]);
    if (mine >= PER_CLIENT_PER_DAY || fromIp >= PER_CLIENT_PER_DAY) {
      return json(
        err("rate_limited", "We already have your request. Message us on X or Telegram if you need anything else."),
        429
      );
    }
    if (site >= SITE_PER_HOUR) {
      return json(
        err("rate_limited", "We're getting a lot of requests right now. Please try again in an hour, or message us on X."),
        429
      );
    }

    const row = await prisma.videoIdeaRequest.create({
      data: {
        ownerId,
        brief: input.brief,
        budget: input.budget,
        style: input.style,
        contactChannel: input.contactChannel,
        contactValue: input.contactValue,
        productUrl: input.productUrl,
        referenceUrl: input.referenceUrl,
        source: input.source,
        ipHash,
      },
      select: { id: true },
    });

    const contact = ideaContactLabel(input.contactChannel, input.contactValue);
    void notifyOperator(
      buildVideoIdeaNotification({
        brief: input.brief,
        budget: IDEA_BUDGETS[input.budget],
        style: input.style ? IDEA_STYLES[input.style] : null,
        contact,
        productUrl: input.productUrl,
        referenceUrl: input.referenceUrl,
        source: input.source,
      })
    );

    return json(ok({ id: row.id, contact }), 201);
  } catch {
    return json(err("internal_error", "Could not send that right now. Please try again, or message us on X."), 500);
  }
}
