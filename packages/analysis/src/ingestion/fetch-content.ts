import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_TEXT_CHARS,
  DEFAULT_TIMEOUT_MS,
  USER_AGENT,
  type FetchImpl,
  type IngestErrorCode,
  type IngestOptions,
  type SourceContent,
  type SourceKind,
} from "./types.js";
import { extractFromHtml, extractFromPlainText } from "./extract.js";

// Sentinel used internally to signal the body exceeded maxBytes.
class TooLargeError extends Error {}

/** Block obviously-internal hosts (SSRF guard). Literal-host only; DNS-rebind
 * revalidation is out of scope (documented in the spec). */
function isBlockedHost(hostname: string): boolean {
  // URL.hostname keeps brackets around IPv6 literals (e.g. "[::1]"); strip them.
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) {
    return true;
  }
  if (h.includes(":")) {
    // IPv6 literal
    if (h === "::1" || h === "::") return true;
    if (/^f[cd]/.test(h)) return true; // fc00::/7 unique local
    if (/^fe8[0-9a-f]/.test(h)) return true; // fe80::/10 link local
    return false;
  }
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

function contentTypeAllowed(ct: string, kind: SourceKind): boolean {
  const c = ct.toLowerCase();
  if (c.startsWith("text/html")) return true;
  if (kind === "docs" && (c.startsWith("text/plain") || c.startsWith("text/markdown"))) {
    return true;
  }
  return false;
}

async function readCappedBody(res: Response, maxBytes: number): Promise<Uint8Array> {
  const cl = res.headers.get("content-length");
  if (cl && Number.isFinite(Number(cl)) && Number(cl) > maxBytes) {
    throw new TooLargeError();
  }

  const body = res.body as ReadableStream<Uint8Array> | null;
  if (body && typeof body.getReader === "function") {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new TooLargeError();
        }
        chunks.push(value);
      }
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.byteLength;
    }
    return out;
  }

  // Fallback: no stream body available.
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) throw new TooLargeError();
  return buf;
}

/**
 * Fetch a single provided URL and extract compact text. Never throws — every
 * failure is captured as a `SourceContent` with status "failed" and an
 * errorCode. Fetches only the exact URL (no crawling/links/sitemap).
 */
export async function fetchUrlContent(
  url: string,
  kind: SourceKind,
  options: IngestOptions = {}
): Promise<SourceContent> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxTextChars = options.maxTextChars ?? DEFAULT_MAX_TEXT_CHARS;
  const fetchImpl: FetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchImpl);
  const now = options.now ?? (() => new Date());
  const fetchedAt = now().toISOString();

  const fail = (
    errorCode: IngestErrorCode,
    errorMessage: string,
    httpStatus?: number
  ): SourceContent => ({
    url,
    kind,
    status: "failed",
    extractedText: "",
    charCount: 0,
    httpStatus,
    errorCode,
    errorMessage,
    fetchedAt,
  });

  // Guards (no request made on failure) ------------------------------------
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return fail("invalid_url", "URL could not be parsed.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return fail("invalid_url", `Unsupported URL scheme: ${parsed.protocol}`);
  }
  if (isBlockedHost(parsed.hostname)) {
    return fail("blocked_host", "Host is not allowed (internal/loopback).");
  }

  // Timed request ----------------------------------------------------------
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html, text/plain" },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!res.ok) {
      return fail("http_error", `HTTP ${res.status}`, res.status);
    }

    // Missing Content-Type is treated leniently as HTML.
    const ct = res.headers.get("content-type") ?? "text/html";
    if (!contentTypeAllowed(ct, kind)) {
      return fail("unsupported_content_type", `Unsupported content type: ${ct}`, res.status);
    }

    const bytes = await readCappedBody(res, maxBytes);
    const raw = new TextDecoder("utf-8").decode(bytes);

    const isHtml = ct.toLowerCase().startsWith("text/html");
    const { title, text } = isHtml
      ? extractFromHtml(raw)
      : { title: undefined, ...extractFromPlainText(raw) };

    const extractedText = text.slice(0, maxTextChars);
    return {
      url,
      kind,
      status: "fetched",
      title,
      extractedText,
      charCount: extractedText.length,
      httpStatus: res.status,
      fetchedAt,
    };
  } catch (err) {
    if (err instanceof TooLargeError) {
      return fail("too_large", `Response exceeded ${maxBytes} bytes.`);
    }
    const aborted =
      controller.signal.aborted ||
      (err instanceof Error && err.name === "AbortError");
    if (aborted) {
      return fail("timeout", `Request timed out after ${timeoutMs}ms.`);
    }
    return fail("network_error", err instanceof Error ? err.message : "Fetch failed.");
  } finally {
    clearTimeout(timer);
  }
}
