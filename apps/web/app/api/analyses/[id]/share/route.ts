import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { err, ok, type ApiResponse } from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

import { isAdminRequest } from "@/lib/admin/auth";
import { getOwnerId } from "@/lib/owner";

// Share-link management (Unit 38). Owner-only (same 404-for-strangers pattern
// as the report route): POST returns the report's share token, creating one if
// absent; DELETE revokes it (the old URL dies). Only COMPLETED reports are
// shareable.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json<T>(body: ApiResponse<T>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

async function loadOwned(id: string) {
  const request = await prisma.analysisRequest.findUnique({
    where: { id },
    include: { report: true },
  });
  if (!request) return null;
  const ownerId = await getOwnerId();
  const isOwner = Boolean(request.ownerId) && request.ownerId === ownerId;
  if (!isOwner && !(await isAdminRequest())) return null;
  return request;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const request = await loadOwned(id);
    if (!request) return json(err("not_found", "Analysis not found."), 404);
    if (!request.report || request.report.status !== "COMPLETED") {
      return json(err("conflict", "Only completed reports can be shared."), 409);
    }

    let token = request.report.shareToken;
    if (!token) {
      token = randomBytes(16).toString("base64url");
      await prisma.report.update({
        where: { id: request.report.id },
        data: { shareToken: token },
      });
    }
    return json(ok({ token }), 200);
  } catch {
    return json(err("internal_error", "Could not create the share link."), 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const request = await loadOwned(id);
    if (!request) return json(err("not_found", "Analysis not found."), 404);
    if (request.report?.shareToken) {
      await prisma.report.update({
        where: { id: request.report.id },
        data: { shareToken: null },
      });
    }
    return json(ok({ revoked: true }), 200);
  } catch {
    return json(err("internal_error", "Could not revoke the share link."), 500);
  }
}
