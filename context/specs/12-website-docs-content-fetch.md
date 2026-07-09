# Unit 12: Website / Docs Content Ingestion

## Goal

Add a lightweight, deterministic content-ingestion module inside `packages/analysis` that fetches the org's **provided** website URL and/or docs URL, extracts compact useful text from the HTML, and returns a small structured context object. It feeds the `websiteText` input already stubbed on `ClassifyOrgInput` (Unit 11) and is consumed by the pipeline in Unit 13.

This is single-URL fetching only — **no crawler**. It fetches exactly the URLs the user supplied on the analysis request, nothing discovered from them. Failure of website/docs fetch must degrade gracefully (lower confidence) and must **never** fail the overall analysis (Invariant 8).

Explicit non-goals for this unit (later units / never):

- **No crawling, no link-following, no sitemap parsing, no browser automation.**
- No worker/pipeline wiring (Unit 13), no API route, UI, or Prisma schema changes.
- No TwitterAPI.io, no OpenAI/live-LLM, no scoring logic.
- No commits.

## Module Design

All ingestion lives under `packages/analysis/src/ingestion/`. Pure text extraction is separated from I/O so it can be tested without a network.

```
packages/analysis/src/ingestion/
  types.ts          # SourceContent / OrgContext / IngestOptions + default constants + error codes
  extract.ts        # pure HTML -> { title?, text } (regex-based, no DOM lib)
  fetch-content.ts  # fetchUrlContent(url, kind, options): guards + timeout + size + content-type + extract
  org-context.ts    # ingestOrgContext({ websiteUrl?, docsUrl? }, options): both sources + combinedText
```

Public functions (exported from the package barrel):

```ts
export function fetchUrlContent(
  url: string,
  kind: SourceKind,
  options?: IngestOptions
): Promise<SourceContent>;

export function ingestOrgContext(
  input: { websiteUrl?: string; docsUrl?: string },
  options?: IngestOptions
): Promise<OrgContext>;
```

- **Deterministic + offline-testable:** `IngestOptions` carries an injectable `fetchImpl` (defaults to global `fetch`) and an injectable `now` (defaults to `() => new Date()`). Tests inject a mock `fetch` returning canned `Response`s and a fixed `now`, so verification needs no network and is fully reproducible. Given the same responses + `now`, output is deep-equal.
- `fetchUrlContent` handles exactly one URL. `ingestOrgContext` calls it for each provided URL **independently** (one failing never affects the other) and assembles the `OrgContext`.
- Neither function ever throws — all failures are captured in the returned `SourceContent`.

## Input / Output Shape

Types live in `packages/analysis` (analysis-internal; not shared) as plain TypeScript — no new `zod` schema needed (these are not a provider trust boundary). The compact object carries enough for evidence/debugging.

```ts
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
  url: string;              // the exact provided URL
  kind: SourceKind;
  status: SourceStatus;
  title?: string;           // from <title>, when found
  extractedText: string;    // compact text; "" when failed/skipped
  charCount: number;        // extractedText.length
  httpStatus?: number;      // set when an HTTP response was received
  errorCode?: IngestErrorCode;    // set when status === "failed"
  errorMessage?: string;          // short, safe (no secrets/stack)
  fetchedAt?: string;       // ISO; set when a fetch was attempted (not for "skipped")
}

export interface OrgContext {
  website: SourceContent;   // status "skipped" when no websiteUrl
  docs: SourceContent;      // status "skipped" when no docsUrl
  combinedText: string;     // bounded concat of fetched sources' text -> ClassifyOrgInput.websiteText
}
```

- `combinedText` concatenates the `extractedText` of the **fetched** sources (website first, then docs), joined with a blank line and re-capped to `maxTextChars`. When nothing was fetched it is `""`. Unit 13 passes it as `ClassifyOrgInput.websiteText`.
- Defaults (constants in `types.ts`, overridable via `IngestOptions`): `timeoutMs = 5000`, `maxBytes = 1_000_000` (1 MB), `maxTextChars = 8000`.

## Fetching Rules

- **Exact URL only.** `GET` the provided URL. Never enqueue, discover, or fetch any other URL (no links, no sitemap, no assets).
- **Scheme allowlist:** only `http:` / `https:`. Anything else (or an unparseable URL) → `invalid_url`, `failed`, no request made.
- **SSRF guard (defensive):** before requesting, reject hosts that are obviously internal — `localhost`, `*.local`, and literal loopback/private/link-local IPs (`127.0.0.0/8`, `::1`, `0.0.0.0`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`) → `blocked_host`, `failed`, no request made. (Note: DNS-rebinding / redirect-target revalidation is out of scope for this unit; documented as future hardening.)
- **Headers:** a simple `User-Agent` (e.g. `kol-fit-analyzer/0.1`) and `Accept: text/html, text/plain`. No cookies/credentials.
- **Redirects:** platform-`fetch` default following is allowed (a server redirecting to its canonical URL is normal); the host guard applies to the initial URL. This is *not* link-crawling.
- **Content-Type allowlist:** the response `Content-Type` must start with `text/html` (for both kinds) or `text/plain` / `text/markdown` (accepted for docs). Anything else (pdf, image, json, octet-stream, …) → `unsupported_content_type`, `failed`.
- **HTTP status:** non-2xx → `http_error`, `failed`, with `httpStatus` set.

## Text Extraction Rules

Pure, deterministic, dependency-free (regex + a tiny entity map — **no** cheerio/jsdom):

1. Decode the response bytes as UTF-8 (`TextDecoder`).
2. Capture `title` from the first `<title>…</title>` (trimmed, entity-decoded, capped e.g. 300 chars).
3. Remove non-content regions: `<script>…</script>`, `<style>…</style>`, `<noscript>…</noscript>`, `<template>…</template>`, and `<!-- … -->` comments.
4. Replace common block-level tags (`</p>`, `</div>`, `<br>`, `</li>`, `</h1..6>`, …) with a newline, then strip all remaining tags.
5. Decode a small set of HTML entities (`&amp; &lt; &gt; &quot; &#39; &nbsp;` + numeric `&#nnn;` / `&#xhh;`).
6. Collapse whitespace: trim lines, drop blank runs, collapse repeated spaces.
7. Truncate to `maxTextChars` (default 8000). `charCount = extractedText.length`.
8. For `text/plain` / `text/markdown`, skip the HTML-stripping steps (2–4) — just decode, collapse, truncate; `title` stays undefined.

If extraction yields empty text, status is still `fetched` with `charCount = 0` (graceful — Unit 13 treats empty as "no evidence", lowering confidence). Extraction never throws.

## Timeout / Size-Limit Behavior

- **Timeout:** an `AbortController` aborts the request after `timeoutMs` (default 5000). An abort/timeout → `timeout`, `failed`.
- **Size limit (two gates):**
  - If a `Content-Length` header is present and exceeds `maxBytes`, fail fast with `too_large` before reading the body.
  - While reading the body (streamed via `response.body` reader, or an equivalent chunked read), stop and fail with `too_large` as soon as accumulated bytes exceed `maxBytes` (do not buffer unbounded, do not silently truncate — oversize is a graceful failure, not partial success).
- Both limits are overridable via `IngestOptions` for tests.

## Error Handling

- Every failure path returns a `SourceContent` with `status: "failed"`, a specific `errorCode` (table below), and a short safe `errorMessage` (no stack traces, no secrets). `fetchUrlContent` and `ingestOrgContext` **never reject**.
- `ingestOrgContext` runs the two sources independently; a failure or exception in one is contained and the other still returns. The overall analysis (Unit 13) uses whatever text is available and lowers confidence otherwise — it never aborts because ingestion failed.

| errorCode | Cause |
| --- | --- |
| `invalid_url` | unparseable URL or non-http(s) scheme (no request made) |
| `blocked_host` | SSRF guard tripped — internal/loopback/private host (no request made) |
| `unsupported_content_type` | response Content-Type not in the allowlist |
| `timeout` | request aborted after `timeoutMs` |
| `too_large` | Content-Length or streamed body exceeded `maxBytes` |
| `http_error` | non-2xx HTTP response (`httpStatus` set) |
| `network_error` | DNS/connection failure or any other thrown error |

`skipped` (not an error) is used when the corresponding URL was not provided.

## Implementation Steps

1. **Deps for `packages/analysis`:** add `@types/node` (dev, for `AbortController`/`TextDecoder`/stream types); add `"types": ["node"]` to `packages/analysis/tsconfig.json`. No runtime deps.
2. **`src/ingestion/types.ts`** — the types above + default constants + the `IngestOptions` interface (`timeoutMs?`, `maxBytes?`, `maxTextChars?`, `fetchImpl?`, `now?`).
3. **`src/ingestion/extract.ts`** — `extractFromHtml(html)` → `{ title?, text }` and a plain-text path; entity decoder; whitespace collapse. Pure functions.
4. **`src/ingestion/fetch-content.ts`** — `fetchUrlContent`: URL parse + scheme/SSRF guards → timed `fetchImpl` GET → status/content-type checks → bounded body read → `extract*` → assemble `SourceContent`; full try/catch mapping to error codes.
5. **`src/ingestion/org-context.ts`** — `ingestOrgContext`: build `skipped` placeholders for missing URLs, fetch provided ones independently, compute `combinedText` (bounded), return `OrgContext`.
6. **`src/index.ts`** — barrel: export `fetchUrlContent`, `ingestOrgContext`, and the types/constants. Replace the `PACKAGE_NAME` placeholder.
7. **Do not touch** `apps/*`, other `packages/*`, or the Prisma schema.

## Dependencies

- **No new runtime dependencies** — uses global `fetch`, `AbortController`, `TextDecoder` (Node 22). Avoids heavy HTML parsers (no cheerio/jsdom) by design.
- New dev dep: `@types/node`.
- No `zod` (plain TS types); no `@kol-fit/shared` needed this unit.

## Verification Checklist

All checks are **offline and disk-light** — `pnpm build` + a `node -e` run against the built package using an **injected `fetchImpl`** (canned `Response`s / small in-process HTML fixtures) and a fixed `now`; **no real network**:

- [ ] `pnpm build` passes across all workspace projects (`packages/analysis` compiles; nothing else changes).
- [ ] **Happy path:** an HTML fixture with `<title>`, `<script>`, `<style>`, and body text → `status "fetched"`, `title` extracted, script/style content absent from `extractedText`, `charCount === extractedText.length`, `length ≤ maxTextChars`, `fetchedAt` set.
- [ ] **Extraction correctness:** entities decoded (`&amp;`→`&`, `&#39;`→`'`) and whitespace collapsed on a small fixture; `text/plain` fixture returns decoded text with no `title`.
- [ ] **Truncation:** a body longer than `maxTextChars` yields `extractedText.length === maxTextChars`.
- [ ] **too_large:** a body (or `Content-Length`) over `maxBytes` → `failed` / `too_large`, no throw.
- [ ] **timeout:** a `fetchImpl` that rejects with an `AbortError` (or never resolves with a tiny `timeoutMs`) → `failed` / `timeout`.
- [ ] **unsupported_content_type:** `Content-Type: application/pdf` → `failed` / `unsupported_content_type`.
- [ ] **http_error:** a 404 response → `failed` / `http_error` with `httpStatus === 404`.
- [ ] **network_error:** a `fetchImpl` that throws → `failed` / `network_error`.
- [ ] **invalid_url:** `"not a url"` and `"ftp://x"` → `failed` / `invalid_url`, and `fetchImpl` was **not** called.
- [ ] **blocked_host:** `http://localhost/`, `http://127.0.0.1/`, `http://192.168.0.1/` → `failed` / `blocked_host`, and `fetchImpl` was **not** called.
- [ ] **skipped + aggregate:** `ingestOrgContext({})` → both `skipped`, `combinedText === ""`; website-fetched + docs-failed → `OrgContext` returns with `combinedText` = website text only, and the call never throws.
- [ ] **Determinism:** identical fixtures + fixed `now` → deep-equal output across two runs.

### Scope guardrails

- [ ] All ingestion logic confined to `packages/analysis`; no crawler abstraction introduced.
- [ ] No worker/pipeline, API route, UI, Prisma schema, TwitterAPI.io, OpenAI, or scoring changes.
- [ ] `context/progress-tracker.md` updated once implemented.
- [ ] No commits made.
```
