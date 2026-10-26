import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

import { prisma } from "@kol-fit/db";

import { getCurrentUserId } from "./auth/current-user";

// Report ownership (Unit 25 anonymous cookie → Unit 28 real accounts). The
// ownership id is EITHER a signed-in user id OR, when logged out, the anonymous
// per-browser `kolfit_owner` cookie. Signing in makes the id become the user id,
// so the 6 existing call sites (list/read/deliver + rate-limit) get per-user
// scoping automatically. The anonymous cookie path is preserved for logged-out
// use — the app is not hard-gated behind login.
const COOKIE = "kolfit_owner";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * The current owner id: the signed-in user id if present, else the anonymous
 * cookie value (or null). Read-only — safe to call during a render.
 */
export async function getOwnerId(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (userId) return userId;
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/**
 * The owner id, creating an anonymous cookie if needed. When signed in, returns
 * the user id and sets no cookie. Otherwise reads, or creates and sets, the
 * `kolfit_owner` cookie. Only call where cookies are writable (route handlers /
 * server actions) — not during a Server Component render.
 */
export async function ensureOwnerId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (userId) return userId;

  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return id;
}

/**
 * `analysisRequestId` if that analysis belongs to `ownerId`, else null. Forms
 * that link a submission to "the report I was reading" take the id from the
 * client; without this check anyone could attach their lead or request to
 * someone else's analysis. Callers drop an unowned link rather than failing,
 * so a real person's request is never lost over it.
 */
export async function ownedAnalysisId(
  analysisRequestId: string | null | undefined,
  ownerId: string
): Promise<string | null> {
  if (!analysisRequestId) return null;
  const owned = await prisma.analysisRequest.findFirst({
    where: { id: analysisRequestId, ownerId },
    select: { id: true },
  });
  return owned?.id ?? null;
}
