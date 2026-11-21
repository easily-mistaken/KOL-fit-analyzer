import { NextResponse } from "next/server";

import { err, ok, type ApiResponse } from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

import { isAdminRequest } from "@/lib/admin/auth";

// Unread badge for the free video idea queue (Unit 57): counts UNSEEN rows.
// Opening /admin/video-ideas marks everything seen.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json<T>(body: ApiResponse<T>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

export async function GET(): Promise<NextResponse> {
  if (!(await isAdminRequest())) {
    return json(err("unauthorized", "Admin session required."), 401);
  }
  try {
    const newCount = await prisma.videoIdeaRequest.count({ where: { seenAt: null } });
    return json(ok({ newCount }), 200);
  } catch {
    return json(err("internal_error", "Could not load counts."), 500);
  }
}
