// Admin login throttle. The panel is guarded by one shared password, so
// unlimited attempts make it guessable online. After MAX_FAILURES wrong
// passwords inside WINDOW_MS, a client is locked out for WINDOW_MS.
//
// In memory on purpose: the site runs as a single Next.js process, the state is
// tiny, and a restart resetting it costs an attacker nothing they couldn't get
// by waiting out the lockout. Keyed by the hashed client IP (lib/client-ip.ts);
// without a trusted IP (local dev) every client shares one bucket.

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;
const MAX_TRACKED = 10_000; // bound memory if someone sprays from many IPs

type Entry = { failures: number; firstFailureAt: number; lockedUntil: number };
const entries = new Map<string, Entry>();

/** Seconds until `key` may try again, or 0 when it is not locked out. */
export function loginRetryAfterSeconds(key: string, now = Date.now()): number {
  const entry = entries.get(key);
  if (!entry || entry.lockedUntil <= now) return 0;
  return Math.ceil((entry.lockedUntil - now) / 1000);
}

/** Records a wrong password; locks `key` out once it reaches MAX_FAILURES. */
export function recordLoginFailure(key: string, now = Date.now()): void {
  let entry = entries.get(key);
  if (!entry || now - entry.firstFailureAt > WINDOW_MS) {
    if (entries.size >= MAX_TRACKED) pruneExpired(now);
    entry = { failures: 0, firstFailureAt: now, lockedUntil: 0 };
    entries.set(key, entry);
  }
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) entry.lockedUntil = now + WINDOW_MS;
}

/** Clears `key` after a successful login. */
export function clearLoginFailures(key: string): void {
  entries.delete(key);
}

function pruneExpired(now: number): void {
  for (const [key, entry] of entries) {
    if (now - entry.firstFailureAt > WINDOW_MS && entry.lockedUntil <= now) {
      entries.delete(key);
    }
  }
}
