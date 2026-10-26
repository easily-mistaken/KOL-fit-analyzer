import { headers } from "next/headers";
import { createHmac } from "node:crypto";

// Client IP for per-IP abuse caps. The owner cookie is client-controlled, so a
// script that never sends it gets a fresh quota on every request; the IP is the
// signal it cannot drop.
//
// Trust model: nginx sets X-Real-IP to $remote_addr after its realip module has
// swapped in CF-Connecting-IP, but ONLY for connections from Cloudflare's
// published ranges (/etc/nginx/conf.d/cloudflare-realip.conf, see DEPLOY.md).
// proxy_set_header overwrites anything the client sent, so the header cannot be
// spoofed, including by clients that skip Cloudflare and hit the VPS directly.
// Without nginx in front (local dev) the header is absent and callers skip the
// per-IP cap.

/**
 * Keyed hash of the client IP, or null when no trusted proxy header is present.
 * Only the hash is stored: an unkeyed hash of an IPv4 address is reversible by
 * brute force, so it is an HMAC under APP_SECRET.
 */
export async function getClientIpHash(): Promise<string | null> {
  const ip = (await headers()).get("x-real-ip")?.trim();
  if (!ip) return null;
  const secret = process.env.APP_SECRET?.trim() || "overlapx-dev-ip-key";
  return createHmac("sha256", secret)
    .update(`client-ip:v1:${ip}`)
    .digest("hex")
    .slice(0, 32);
}
