import { DEFAULT_MAX_PAGES, DEFAULT_TIMEOUT_MS, resolveBaseUrl } from "./endpoints.js";
import { TwitterApiError } from "./errors.js";

export type FetchImpl = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }
) => Promise<Response>;

export type QueryParams = Record<
  string,
  string | number | boolean | undefined
>;

export type UsageStats = {
  requests: number;
  pagesFetched: number;
  usersFetched: number;
  tweetsFetched: number;
  byEndpoint: Record<string, number>;
};

export interface TwitterApiClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchImpl;
  maxPages?: number;
}

type Raw = Record<string, unknown>;

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Low-level TwitterAPI.io HTTP client: auth header, timeout, error mapping, and
 * cursor pagination. Holds no Twitter-shape knowledge beyond the response
 * envelope; item mapping is supplied by the caller. Never logs/throws the key.
 */
export class TwitterApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchImpl;
  private readonly maxPages: number;
  private readonly usage: UsageStats = {
    requests: 0,
    pagesFetched: 0,
    usersFetched: 0,
    tweetsFetched: 0,
    byEndpoint: {},
  };

  constructor(options: TwitterApiClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = resolveBaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchImpl);
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  }

  getUsageStats(): UsageStats {
    return { ...this.usage, byEndpoint: { ...this.usage.byEndpoint } };
  }

  private buildUrl(path: string, params: QueryParams): string {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      qs.set(k, String(v));
    }
    const q = qs.toString();
    return `${this.baseUrl}${path}${q ? `?${q}` : ""}`;
  }

  private async request(path: string, params: QueryParams): Promise<Raw> {
    this.usage.requests++;
    this.usage.byEndpoint[path] = (this.usage.byEndpoint[path] ?? 0) + 1;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(this.buildUrl(path, params), {
        method: "GET",
        headers: { "X-API-Key": this.apiKey, Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (err) {
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        throw new TwitterApiError("timeout", `Request timed out after ${this.timeoutMs}ms.`);
      }
      throw new TwitterApiError(
        "network_error",
        err instanceof Error ? err.message : "Network request failed."
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const code =
        res.status === 401 || res.status === 403
          ? "auth_error"
          : res.status === 429
            ? "rate_limited"
            : res.status === 404
              ? "not_found"
              : "provider_error";
      throw new TwitterApiError(code, `TwitterAPI.io HTTP ${res.status}`, res.status);
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new TwitterApiError("network_error", "Response body was not valid JSON.");
    }
    if (!body || typeof body !== "object") {
      throw new TwitterApiError("invalid_response", "Unexpected response envelope.");
    }
    return body as Raw;
  }

  private isErrorStatus(body: Raw): boolean {
    return typeof body.status === "string" && body.status.toLowerCase() === "error";
  }

  private errorMessage(body: Raw): string {
    return asString(body.message) ?? asString(body.msg) ?? "unknown error";
  }

  /** Single-object fetch (user profile). Returns the body, or null on a soft
   * error status (treated as not-found by the caller). Throws on HTTP errors. */
  async fetchOne(path: string, params: QueryParams): Promise<Raw | null> {
    const body = await this.request(path, params);
    this.usage.pagesFetched++;
    if (this.isErrorStatus(body)) return null;
    return body;
  }

  /**
   * Collect items across cursor pages up to `limit`. `arrayFrom` pulls the raw
   * item array from the envelope; `mapItem` normalizes each (null → skipped).
   * Stops at limit, `has_next_page:false`, an empty/repeated cursor, or the
   * maxPages guard. A `status:"error"` mid-list throws.
   */
  async collect<T>(
    path: string,
    baseParams: QueryParams,
    limit: number,
    arrayFrom: (body: Raw) => unknown,
    mapItem: (raw: unknown) => T | null,
    countAs?: "users" | "tweets"
  ): Promise<T[]> {
    const out: T[] = [];
    let cursor = "";
    let pages = 0;

    while (out.length < limit && pages < this.maxPages) {
      const body = await this.request(path, { ...baseParams, cursor });
      this.usage.pagesFetched++;
      if (this.isErrorStatus(body)) {
        throw new TwitterApiError("provider_error", `TwitterAPI.io error: ${this.errorMessage(body)}`);
      }

      const rawItems = arrayFrom(body);
      if (!Array.isArray(rawItems) || rawItems.length === 0) break;
      if (countAs === "users") this.usage.usersFetched += rawItems.length;
      else if (countAs === "tweets") this.usage.tweetsFetched += rawItems.length;

      for (const raw of rawItems) {
        const item = mapItem(raw);
        if (item !== null) out.push(item);
        if (out.length >= limit) break;
      }
      pages++;

      const nextCursor = asString(body.next_cursor);
      if (body.has_next_page === false || !nextCursor || nextCursor === cursor) break;
      cursor = nextCursor;
    }

    return out;
  }
}
