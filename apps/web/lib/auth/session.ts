import { cookies } from "next/headers";
import { signSessionToken, verifySessionToken } from "@kol-fit/auth";

// Dev-mode session cookie (Unit 28). A stateless HMAC-signed token from
// @kol-fit/auth, keyed on AUTH_SESSION_SECRET (read only from env, never
// logged/returned). If the secret is unset, dev sessions are disabled and every
// caller is treated as logged-out — a safe fallback that can't half-work.

const COOKIE = "kolfit_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** The configured signing secret, or null when dev sessions are disabled. */
function sessionSecret(): string | null {
  const raw = process.env.AUTH_SESSION_SECRET;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

/** Verifies the session cookie and returns the signed-in user id, or null. */
export async function readDevUserId(): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token, secret);
}

/** Issues the dev session cookie for `userId`. Only call from a route handler. */
export async function setDevSession(userId: string): Promise<void> {
  const secret = sessionSecret();
  if (!secret) return;
  const token = signSessionToken(userId, secret);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Clears the dev session cookie. Safe to call without a session. */
export async function clearDevSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
