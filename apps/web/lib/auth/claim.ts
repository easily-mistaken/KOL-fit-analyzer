import { cookies } from "next/headers";
import { prisma } from "@kol-fit/db";

// Claim-on-login (Unit 28). Logging in adopts the current anonymous browser's
// history into the account: the analyses tagged with the `kolfit_owner` cookie
// id are re-assigned to the user id. Anonymous use stays supported; the app is
// not hard-gated behind login.

const OWNER_COOKIE = "kolfit_owner";

/**
 * Re-assigns any AnalysisRequests owned by the current anonymous cookie id to
 * `userId`. Best-effort — it never throws out of login, and logs only the count
 * (no PII, no ids).
 */
export async function claimAnonymousReports(userId: string): Promise<void> {
  try {
    const cookieId = (await cookies()).get(OWNER_COOKIE)?.value;
    if (!cookieId || cookieId === userId) return;

    const result = await prisma.analysisRequest.updateMany({
      where: { ownerId: cookieId },
      data: { ownerId: userId },
    });
    console.log(`[auth] claimed ${result.count} anonymous report(s) on login`);
  } catch (error) {
    console.error("[auth] claim failed (non-fatal)");
  }
}
