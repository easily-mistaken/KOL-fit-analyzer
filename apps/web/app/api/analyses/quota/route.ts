import { NextResponse } from "next/server";

import { resolveTierLimits, ok, err, type ApiResponse } from "@kol-fit/shared";

import { getCurrentUser } from "@/lib/auth";
import { getOwnerId } from "@/lib/owner";
import { countLifetimeAnalyses } from "@/lib/tier-gate";

// Quota indicator (Unit 39): how many analyses this visitor has left in their
// current tier. Read-only — uses getOwnerId (never sets a cookie on a read).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type QuotaResponse = {
  used: number;
  limit: number;
  /** The signed-in allowance, regardless of the caller's current tier — lets the
   *  anonymous login wall say "unlock N more" without hardcoding the number. */
  signedInLimit: number;
  isAuthenticated: boolean;
};

function json<T>(body: ApiResponse<T>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

export async function GET(): Promise<NextResponse> {
  try {
    const limits = resolveTierLimits(process.env);
    const user = await getCurrentUser();
    const ownerId = await getOwnerId();
    const used = ownerId ? await countLifetimeAnalyses(ownerId) : 0;
    const limit = user ? limits.userLifetime : limits.anonLifetime;
    return json(
      ok<QuotaResponse>({
        used,
        limit,
        signedInLimit: limits.userLifetime,
        isAuthenticated: Boolean(user),
      }),
      200
    );
  } catch {
    return json(err("internal_error", "Could not load quota."), 500);
  }
}
