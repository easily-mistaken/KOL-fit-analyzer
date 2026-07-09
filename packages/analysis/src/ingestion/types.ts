// Website/docs content ingestion — shared types, constants, and options.
// Analysis-internal (not a provider trust boundary), so plain TS, no zod.

export type SourceKind = "website" | "docs";
export type SourceStatus = "fetched" | "failed" | "skipped";

export type IngestErrorCode =
  | "invalid_url"
  | "blocked_host"
  | "unsupported_content_type"
  | "timeout"
  | "too_large"
  | "http_error"
  | "network_error";

export interface SourceContent {
  /** The exact provided URL. */
  url: string;
  kind: SourceKind;
  status: SourceStatus;
  /** From <title>, when found. */
  title?: string;
  /** Compact extracted text; "" when failed/skipped. */
  extractedText: string;
  /** extractedText.length. */
  charCount: number;
  /** Set when an HTTP response was received. */
  httpStatus?: number;
  /** Set when status === "failed". */
  errorCode?: IngestErrorCode;
  /** Short, safe message (no stack/secrets). Set on failure. */
  errorMessage?: string;
  /** ISO timestamp; set when a fetch was attempted (not for "skipped"). */
  fetchedAt?: string;
}

export interface OrgContext {
  website: SourceContent;
  docs: SourceContent;
  /** Bounded concat of fetched sources' text -> ClassifyOrgInput.websiteText. */
  combinedText: string;
}

/** Minimal fetch surface we depend on — lets tests inject a mock. */
export type FetchImpl = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    redirect?: "follow" | "manual" | "error";
    signal?: AbortSignal;
  }
) => Promise<Response>;

export interface IngestOptions {
  /** Request timeout in ms (default 5000). */
  timeoutMs?: number;
  /** Max downloaded body bytes (default 1_000_000). */
  maxBytes?: number;
  /** Max characters kept in extractedText / combinedText (default 8000). */
  maxTextChars?: number;
  /** Injectable fetch (default: global fetch). */
  fetchImpl?: FetchImpl;
  /** Injectable clock for deterministic fetchedAt (default: () => new Date()). */
  now?: () => Date;
}

export const DEFAULT_TIMEOUT_MS = 5000;
export const DEFAULT_MAX_BYTES = 1_000_000;
export const DEFAULT_MAX_TEXT_CHARS = 8000;

export const USER_AGENT = "kol-fit-analyzer/0.1";
