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
 * The unit one client controls. IPv4: the address. IPv6: the /64 prefix, since
 * ISPs hand each home or phone a /64 (or larger) and any address inside it can
 * be used, so counting full addresses would let one client rotate past the cap.
 */
export function ipRateKey(ip: string): string {
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!ip.includes(":")) return ip;
  const [head, tail] = ip.toLowerCase().split("%")[0].split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const missing = Math.max(0, 8 - headParts.length - tailParts.length);
  const full =
    tail === undefined
      ? headParts
      : [...headParts, ...new Array<string>(missing).fill("0"), ...tailParts];
  return `${full
    .slice(0, 4)
    .map((h) => (parseInt(h, 16) || 0).toString(16))
    .join(":")}::/64`;
}

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
    .update(`client-ip:v1:${ipRateKey(ip)}`)
    .digest("hex")
    .slice(0, 32);
}
