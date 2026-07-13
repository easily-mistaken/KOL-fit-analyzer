import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless signed dev-session token (Unit 28). The token is
//   `${userId}.${base64url(hmacSHA256(userId, secret))}`
// so the userId is readable but only the holder of the secret can forge it. The
// secret is read from the environment by the caller and is never embedded here.

/** base64url HMAC-SHA256 of `userId` under `secret`. */
function signature(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(userId).digest("base64url");
}

/** Signs a session token for `userId`. */
export function signSessionToken(userId: string, secret: string): string {
  return `${userId}.${signature(userId, secret)}`;
}

/**
 * Verifies a session token and returns the `userId` iff the HMAC matches
 * (constant-time compare). Returns null on any tamper / malformed input / secret
 * mismatch. Never throws.
 */
export function verifySessionToken(
  token: string,
  secret: string
): string | null {
  try {
    if (typeof token !== "string" || typeof secret !== "string") return null;
    if (token.length === 0 || secret.length === 0) return null;

    // Exactly two segments: userId and signature. A cuid/UUID contains no dot,
    // so "extra segments" (more than one dot) is treated as malformed.
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [userId, provided] = parts;
    if (!userId || !provided) return null;

    const expected = signature(userId, secret);
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    // Different length can't be timing-safe compared; also means a mismatch.
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;

    return userId;
  } catch {
    // Defensive: never throw out of verification (e.g. odd Buffer inputs).
    return null;
  }
}
