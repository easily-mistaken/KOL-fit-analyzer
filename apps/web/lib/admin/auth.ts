import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";

// Admin session (Unit 27). A single shared password from the environment gates
// the read-only admin panel. This is an internal-operator gate, not a user
// identity system — real accounts/roles remain the future auth unit.
//
// Fail-closed: with no ADMIN_PASSWORD set, the panel is disabled entirely.
// The password is only read from env, compared in constant time, and never
// logged or returned to the client.

const COOKIE = "kolfit_admin";
const MAX_AGE = 60 * 60 * 12; // 12h
const TOKEN_PREFIX = "kolfit-admin-v1:";

/** The configured password, or null when the panel is disabled. */
function adminPassword(): string | null {
  const raw = process.env.ADMIN_PASSWORD;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

export function isAdminConfigured(): boolean {
  return adminPassword() !== null;
}

/**
 * The cookie value for the configured password. Derived from the password, so
 * rotating ADMIN_PASSWORD invalidates every existing session.
 */
function expectedToken(password: string): string {
  return createHash("sha256")
    .update(TOKEN_PREFIX + password)
    .digest("hex");
}

/** Constant-time compare of two strings of arbitrary length. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** True when `candidate` matches the configured admin password. */
export function verifyAdminPassword(candidate: unknown): boolean {
  const password = adminPassword();
  if (!password || typeof candidate !== "string") return false;
  return safeEqual(candidate, password);
}

/** True when the request carries a valid admin session cookie. */
export async function isAdminRequest(): Promise<boolean> {
  const password = adminPassword();
  if (!password) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  return safeEqual(token, expectedToken(password));
}

/**
 * Guards an admin page: redirects to the login page unless the session is
 * valid. Returns nothing — call it first in the page body.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminRequest())) redirect("/admin/login");
}

/** Issues the admin session cookie. Only call from a route handler. */
export async function setAdminSession(): Promise<void> {
  const password = adminPassword();
  if (!password) return;
  (await cookies()).set(COOKIE, expectedToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Clears the admin session cookie. Only call from a route handler. */
export async function clearAdminSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
