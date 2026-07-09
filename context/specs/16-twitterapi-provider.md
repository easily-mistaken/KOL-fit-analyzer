# Unit 16: Live TwitterAPI.io Provider

## Goal

Implement the real **TwitterAPI.io** provider behind the existing `TwitterProvider` interface, selected by `TWITTER_PROVIDER=twitterapi`. It fetches live Twitter/X data via HTTP, normalizes responses into the provider-neutral shared types (`TwitterUser` / `Tweet` / `EngagedAccountRaw`), respects `ANALYSIS_CAPS`, times out, maps errors to typed provider errors, and tracks lightweight request/cost metadata. The mock provider stays untouched and remains the default for offline development. All TwitterAPI.io-specific logic lives inside `packages/twitter`.

> **API shapes:** the endpoint paths and response shapes below were taken from the official TwitterAPI.io docs (`docs.twitterapi.io`) — see *Confirmed API Reference* and *Sources* at the end. All eight endpoint paths are confirmed (the quotations path `/twitter/tweet/quotes` was confirmed by the user). Paths are centralized in `endpoints.ts`.

Explicit non-goals (later units / never):

- No worker/pipeline, UI, API-route, Prisma-schema, LLM, or scoring changes.
- No caching or real cost/rate-limit controls beyond minimal in-memory request metadata — **Unit 19 owns caching/cost controls**.
- No KOL discovery (the `searchTweets` method is implemented for interface completeness only).
- No commits. Never hardcode/print the API key; never commit `.env`.

## TwitterAPI.io Provider Design

New code under `packages/twitter/src/twitterapi/` (mock and interface untouched):

```
packages/twitter/src/
  provider.ts            # TwitterProvider interface (unchanged)
  factory.ts             # add the "twitterapi" branch (currently throws)
  mock/                  # unchanged
  twitterapi/
    endpoints.ts         # base URL + path constants (single source of truth)
    errors.ts            # TwitterApiError + TwitterApiErrorCode
    client.ts            # low-level HTTP: auth header, timeout, error mapping, cursor pagination, usage counter
    normalize.ts         # raw user/tweet JSON -> shared types (+ Zod validation)
    provider.ts          # TwitterApiProvider implements TwitterProvider
```

- `TwitterApiProvider` is constructed with `{ apiKey, baseUrl?, timeoutMs?, fetchImpl?, maxPages? }`. `fetchImpl` defaults to global `fetch` and is **injectable** so verification runs fully offline against canned JSON (real doc shapes). No `Date.now`/randomness in normalization → deterministic given fixed inputs.
- The provider depends only on the shared types/schemas + the low-level client. It never imports the mock. Swappability is preserved: `createTwitterProvider()` returns mock or live by config; both satisfy the same interface.
- Auth: every request sends the `X-API-Key: <TWITTERAPI_IO_KEY>` header. The key is read once at construction from env (via the factory) and **never logged, thrown, or included in error messages**.

## Endpoint / Method Mapping

Base URL `https://api.twitterapi.io` (override via `TWITTERAPI_IO_BASE_URL`). All GET, `X-API-Key` header. Pagination: `cursor` (empty string first page), responses carry `has_next_page` + `next_cursor`; the client loops pages until the cap is reached, `has_next_page` is false / `next_cursor` empty, or `maxPages` guard trips (avoids infinite loops on stale cursors).

| Interface method | Path | Params | Result array | Per-item → shared |
| --- | --- | --- | --- | --- |
| `getUserProfile(handle)` | `/twitter/user/info` | `userName` | `data` (single) | `TwitterUser \| null` (null when `status!=="success"` or `data` absent) |
| `getUserTweets(handle, limit)` | `/twitter/user/last_tweets` | `userName`, `cursor`, `includeReplies=false` | `tweets[]` | `Tweet[]` (drop retweets/replies; cap `limit`) |
| `getUserReplies(handle, limit)` | `/twitter/user/last_tweets` | `userName`, `cursor`, `includeReplies=true` | `tweets[]` | `Tweet[]`, keep only `isReply===true`, cap `limit` |
| `getTweetReplies(tweetId, limit)` | `/twitter/tweet/replies/v2` | `tweetId`, `cursor` | `tweets[]` (each has `author`) | `EngagedAccountRaw[]` `source:"REPLY"` from `author` |
| `getTweetQuotes(tweetId, limit)` | `/twitter/tweet/quotes` | `tweetId`, `cursor` | `tweets[]` (each has `author`) | `EngagedAccountRaw[]` `source:"QUOTE"` from `author` |
| `getTweetRetweeters(tweetId, limit)` | `/twitter/tweet/retweeters` | `tweetId`, `cursor` | `users[]` | `EngagedAccountRaw[]` `source:"RETWEET"` from user |
| `getFollowers(handle, limit)` | `/twitter/user/followers` | `userName`, `cursor`, `pageSize=200` | `followers[]` | `TwitterUser[]` |
| `searchTweets(query, limit)` | `/twitter/tweet/advanced_search` | `query`, `queryType="Latest"`, `cursor` | `tweets[]` | `Tweet[]` |

- **Caps:** `limit` (the caller passes `ANALYSIS_CAPS` values) bounds total items collected across pages for every list method — the client stops paging once `limit` items are gathered. Page sizes are the API defaults (tweets/replies/quotes ~20, retweeters ~100, followers up to 200), not tunable here.
- The response array field varies by endpoint (`data` / `tweets` / `followers` / `users`); the client resolves it by a documented lookup (below), so one helper handles all envelopes.

## Input / Output Normalization

The client extracts the array via a tolerant accessor: **items** = first present of `tweets` → `followers` → `users` → (`data` as single for profile); **status** = `status`; **message** = `message` ?? `msg`; **pagination** = `has_next_page` + `next_cursor` (followers may omit `has_next_page` → continue while `next_cursor` is non-empty and a page returned items).

Field mapping (raw TwitterAPI.io → shared), all target fields optional-safe (missing → `undefined`, lowering confidence downstream, never throwing — Invariant 8):

**User** (`data` / `followers[]` / `users[]` / `tweet.author`) → `TwitterUser`:
`id←id`, `handle←userName`, `displayName←name`, `bio←description`, `followersCount←followers`, `followingCount←following`, `tweetCount←statusesCount`, `verified←isBlueVerified`, `createdAt←createdAt`, `avatarUrl←profilePicture`.

**Tweet** (`tweets[]`) → `Tweet`:
`id←id`, `authorId←author.id`, `authorHandle←author.userName`, `text←text`, `createdAt←createdAt`, `likeCount←likeCount`, `retweetCount←retweetCount`, `replyCount←replyCount`, `quoteCount←quoteCount`, `viewCount←viewCount`, `isReply←isReply`, `isQuote←Boolean(quoted_tweet)`, `lang←lang`.

**Engaged account** → `EngagedAccountRaw`: `{ user: normalizeUser(tweet.author | user), tweetId, source }`.

- **Validation (Invariant 9/12):** each normalized object is parsed with the shared schema (`TwitterUserSchema` / `TweetSchema` / `EngagedAccountRawSchema`). Items that fail validation are **skipped** (logged at debug, count tracked) rather than failing the whole call — a few malformed rows must not sink an analysis. Counts are coerced to non-negative ints; unexpected types → dropped field.
- Numeric strings (some counts may arrive as strings) are coerced with `Number(...)` then validated; non-finite → `undefined`.

## Error Handling

`errors.ts` defines `class TwitterApiError extends Error` with a `code: TwitterApiErrorCode`:

| code | Cause |
| --- | --- |
| `auth_error` | HTTP 401/403 (bad/missing key) |
| `rate_limited` | HTTP 429 |
| `not_found` | HTTP 404 or `status:"error"` indicating missing resource (profile → normalized to `null`, not thrown) |
| `provider_error` | HTTP 5xx or `status:"error"` (other) |
| `timeout` | request aborted after `timeoutMs` |
| `network_error` | connection/DNS failure or non-JSON body |
| `invalid_response` | JSON parsed but envelope unusable |

- Requests use an `AbortController` with `timeoutMs` (default 15000, override `TWITTERAPI_IO_TIMEOUT_MS`). Timeout → `timeout`.
- The client throws `TwitterApiError` (no key/PII in the message). **Graceful boundaries:** `getUserProfile` returns `null` on `not_found`; list methods return whatever items were collected before an error on a **later** page (partial success), but a **first-page** hard failure throws so the pipeline/worker can record the job FAILED (existing behavior — the worker already catches provider throws). This keeps live failures visible without corrupting a report.
- No retry/backoff logic here beyond a single request per page (retries/backoff are a later hardening concern; the 24h cursor caveat is documented). Never logs the API key.

## Rate / Cost Metadata Behavior

Minimal and in-memory only (no schema change, no persistence — Unit 19 owns real controls):

- The client keeps counters on the provider instance: `requests`, `pagesFetched`, `usersFetched`, `tweetsFetched`, and per-endpoint request counts.
- Exposed via a concrete-only method `getUsageStats(): UsageStats` on `TwitterApiProvider` (**not** on the `TwitterProvider` interface, so the interface/DTO/schema are unchanged and the mock is unaffected). Callers that hold the interface never see it; a debug/observability caller can read it.
- Optionally emit a single structured `console.debug` summary at the end of a run (request/tweet counts) — **never** the key. This gives cost visibility for a live analysis without building the Unit 19 machinery.

## Provider Selection Behavior

- `factory.ts`: replace the `"twitterapi"` throw with `return new TwitterApiProvider({ apiKey })`, where `apiKey = process.env.TWITTERAPI_IO_KEY`. If the key is missing/empty, throw a clear `TwitterApiError("auth_error", "TWITTERAPI_IO_KEY is not set")` — fail fast, no silent fallback to mock.
- Resolution order unchanged: `options.kind` → `process.env.TWITTER_PROVIDER` → `"mock"`. Mock stays the **default**; live is opt-in via `TWITTER_PROVIDER=twitterapi`.
- `createTwitterProvider()` remains the single seam; both providers implement the same interface, so the pipeline/worker are unaffected and swappable.

## Offline Verification Strategy

Fully offline, no network — inject `fetchImpl` returning canned `Response`s built from the **real documented shapes** (see *Confirmed API Reference*):

- Unit-test each of the 8 methods with a stub `fetchImpl`: assert the correct path + params (incl. `userName`/`tweetId`/`cursor`/`includeReplies`/`queryType`/`pageSize`) and `X-API-Key` header were sent, and that normalized output validates against the shared schemas.
- **Pagination + caps:** stub multi-page responses (`has_next_page:true` then false); assert the client pages until `limit`, respects the cap, and stops (never exceeds `maxPages`).
- **Envelope tolerance:** feed the varied envelopes (`data`/`msg`, `followers`/`message`, `tweets`/`users`) and confirm each normalizes.
- **Graceful degradation:** a response with one malformed item → that item skipped, valid ones returned; profile `status:"error"` → `null`.
- **Error mapping:** stub 401/429/500/timeout(AbortError)/non-JSON → assert the right `TwitterApiError.code`; assert the key never appears in any thrown message.
- **Determinism:** same canned input → deep-equal normalized output.

## Optional Live Verification Strategy

Opt-in, **only when `TWITTERAPI_IO_KEY` is present** (skipped otherwise; never in CI):

- A small guarded script (e.g. `node -e`, key from env) calls one cheap endpoint — `getUserProfile("<a known handle>")` — and asserts the result validates as `TwitterUser`. Optionally one `getUserTweets(handle, 5)` to confirm tweet normalization.
- Keep it to the minimum billable calls (profile is ~$0.00018/call). Print only field presence/counts — **never** the key or raw PII dumps. Document that it costs real money and is manual-only.

## Implementation Steps

1. `packages/twitter/src/twitterapi/endpoints.ts` — `BASE_URL` (env override) + path constants (all eight paths confirmed).
2. `errors.ts` — `TwitterApiError` + `TwitterApiErrorCode`.
3. `client.ts` — `request(path, params, { signal })` (auth header, timeout, JSON parse, envelope/array/status/pagination accessors, error mapping) + `collect(path, params, limit, mapItem)` pagination helper + usage counters.
4. `normalize.ts` — `normalizeUser`, `normalizeTweet`, `normalizeEngaged` with shared-schema validation + skip-on-invalid.
5. `provider.ts` — `TwitterApiProvider implements TwitterProvider` wiring the 8 methods to client+normalize per the mapping table; `getUsageStats()`.
6. `factory.ts` — implement the `"twitterapi"` branch (read `TWITTERAPI_IO_KEY`, construct provider, fail fast if missing).
7. `index.ts` — export `TwitterApiProvider` + `TwitterApiError` (types/class) for observability; keep mock exports.
8. `.env.example` — document optional `TWITTERAPI_IO_BASE_URL` and `TWITTERAPI_IO_TIMEOUT_MS` (both optional; `TWITTERAPI_IO_KEY` already present). No secrets committed.
9. Confirm **no** changes to the interface, mock, pipeline, worker, API routes, UI, or Prisma schema.

## Dependencies

- **No new npm packages** — global `fetch`/`AbortController` (Node 22); `@types/node` already present (Unit 10). Validation reuses `@kol-fit/shared` schemas (already a dep). No HTTP client library, no TwitterAPI SDK.

## Environment Variables

- `TWITTERAPI_IO_KEY` — **required** when `TWITTER_PROVIDER=twitterapi`; read from env only, never hardcoded/logged. Already in `.env.example`.
- `TWITTER_PROVIDER=twitterapi` — selects the live provider (default `mock`). Already in `.env.example`.
- `TWITTERAPI_IO_BASE_URL` — optional override (default `https://api.twitterapi.io`); handy for pointing tests/staging at a mock server.
- `TWITTERAPI_IO_TIMEOUT_MS` — optional per-request timeout (default `15000`).
- `.env` is never committed; `.env.example` holds only placeholders/defaults.

## Confirmed API Reference (from docs.twitterapi.io)

- Base `https://api.twitterapi.io`, header `X-API-Key`. Cursor pagination (`cursor` empty-string first page; `has_next_page` + `next_cursor`); cursors valid ~24h.
- `GET /twitter/user/info?userName=` → `{ data: {UserInfo}, status, msg }`.
- `GET /twitter/user/last_tweets?userName=&cursor=&includeReplies=` → `{ tweets:[{…, author:{…}}], has_next_page, next_cursor, status, message }`.
- `GET /twitter/user/followers?userName=&cursor=&pageSize=` (20–200, default 200) → `{ followers:[User], status, message }`.
- `GET /twitter/tweet/replies/v2?tweetId=&cursor=&queryType=` → `{ tweets:[{…, author}], has_next_page, next_cursor, status, message }`.
- `GET /twitter/tweet/retweeters?tweetId=&cursor=` → `{ users:[User], has_next_page, next_cursor, status, message }`.
- `GET /twitter/tweet/quotes?tweetId=&cursor=` → `{ tweets:[{…, author}], has_next_page, next_cursor, status, message }` (docs title "Get Tweet Quotations"; ~20 quotes per page; path confirmed by user).
- `GET /twitter/tweet/advanced_search?query=&queryType=Latest|Top&cursor=` → `{ tweets:[{…, author}], has_next_page, next_cursor }`.
- **UserInfo fields:** `id, userName, name, description, followers, following, statusesCount, isBlueVerified, verifiedType, createdAt, profilePicture, location, …`.
- **Tweet fields:** `id, url, text, retweetCount, replyCount, likeCount, quoteCount, viewCount, createdAt, lang, isReply, inReplyToId, conversationId, quoted_tweet, retweeted_tweet, author:{…}`.
- Envelope keys are inconsistent across endpoints (`data`/`tweets`/`followers`/`users`; `msg`/`message`) — the normalizer tolerates all.
- Pricing (for cost metadata context): ~$0.15 / 1k tweets, ~$0.18 / 1k user profiles.

## Verification Checklist

Offline (primary — no network):
- [ ] `pnpm build` passes across all workspace projects.
- [ ] Each of the 8 methods, driven by an injected `fetchImpl` with doc-shaped JSON, sends the correct path/params + `X-API-Key` header and returns output validating against the shared schemas.
- [ ] Pagination collects across pages up to `limit`, respects the cap, and stops at `has_next_page:false` / `maxPages`.
- [ ] Varied envelopes (`data`/`msg`, `followers`, `users`, `tweets`) all normalize; malformed items are skipped (valid ones returned); profile `status:"error"` → `null`.
- [ ] Error mapping: 401→`auth_error`, 429→`rate_limited`, 404→`not_found`, 5xx→`provider_error`, AbortError→`timeout`, non-JSON→`network_error`/`invalid_response`; **the API key never appears** in any thrown message or log (grep the code: key only read from env, only set as header).
- [ ] `createTwitterProvider({ kind: "twitterapi" })` with a set key returns a `TwitterApiProvider`; with no key throws a clear `auth_error`; default/`mock` still returns the mock; the mock provider is byte-unchanged.
- [ ] Determinism: same canned responses → deep-equal normalized output.

Optional live (manual, only with `TWITTERAPI_IO_KEY`):
- [ ] `getUserProfile` for a known handle returns a schema-valid `TwitterUser`; minimal billable calls; no key printed.

Scope guardrails:
- [ ] All TwitterAPI.io logic confined to `packages/twitter/src/twitterapi/`; interface + mock unchanged; no pipeline/worker/UI/API-route/Prisma/LLM/scoring changes; no caching/discovery.
- [ ] `context/progress-tracker.md` updated once implemented. No commits.

## Sources

- [Get User Last Tweets](https://docs.twitterapi.io/api-reference/endpoint/get_user_last_tweets)
- [Get User Info](https://docs.twitterapi.io/api-reference/endpoint/get_user_by_username)
- [Get User Followers](https://docs.twitterapi.io/api-reference/endpoint/get_user_followers)
- [Get Tweet Replies V2](https://docs.twitterapi.io/api-reference/endpoint/get_tweet_replies_v2)
- [Get Tweet Retweeters](https://docs.twitterapi.io/api-reference/endpoint/get_tweet_retweeter)
- [Advanced Search](https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search)
- [TwitterAPI.io Introduction / auth](https://docs.twitterapi.io/introduction)
