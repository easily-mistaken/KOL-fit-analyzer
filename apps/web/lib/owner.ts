import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

// Anonymous per-browser owner (Unit 25). A private cookie identifies the
// browser that created an analysis, so report visibility can be scoped without
// accounts/auth (which are deferred). Cleared cookies / other devices won't see
// the history — the honest limit of a pre-auth model.
const COOKIE = "kolfit_owner";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Reads the owner id from the cookie (works anywhere cookies are readable). */
export async function getOwnerId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/**
 * Reads, or creates and sets, the owner cookie. Only call where cookies are
 * writable (route handlers / server actions) — not during a Server Component
 * render.
 */
export async function ensureOwnerId(): Promise<string> {
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
