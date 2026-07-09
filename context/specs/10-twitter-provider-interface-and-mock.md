# Unit 10: Twitter Provider Interface and Mock Provider

## Goal

Give `packages/twitter` its provider abstraction: a `TwitterProvider` interface (the method set from `architecture.md`) that returns the provider-neutral normalized types from `@kol-fit/shared`, plus a **deterministic mock implementation** and a small factory so later units select a provider by config. No live TwitterAPI.io, no network — the mock returns stable, varied fixtures rich enough to drive the Unit 13 pipeline and (later) audience classification.

This is the first provider package to gain real content. It is consumed by nobody yet — the worker/pipeline wire-up is Unit 13.

Explicit non-goals for this unit (later units own these):

- **No TwitterAPI.io integration / no network calls** (Unit 16). Only the interface + mock.
- No worker/pipeline changes (Unit 13), no API route, UI, or Prisma schema changes.
- No LLM, scoring, or analysis-pipeline logic.
- No KOL discovery / search marketplace — this is known-org + known-KOL only; `searchTweets` exists to match the interface but is intentionally minimal.
- No commits.

## Provider Interface Design

All Twitter/X access goes through this interface (Invariant 2). It lives in `packages/twitter` and returns only shared normalized types. Method set matches `architecture.md` → *Twitter/X Provider Interface*.

```ts
import type { TwitterUser, Tweet, EngagedAccountRaw } from "@kol-fit/shared";

export interface TwitterProvider {
  // Profiles (org or KOL). null = not found (graceful, not a throw).
  getUserProfile(handle: string): Promise<TwitterUser | null>;

  // A user's own posts / replies, newest-first, capped by `limit`.
  getUserTweets(handle: string, limit: number): Promise<Tweet[]>;
  getUserReplies(handle: string, limit: number): Promise<Tweet[]>;

  // Engagement on a specific tweet. Each engager carries the full TwitterUser
  // (incl. bio) needed for later audience classification, tied to the tweet id
  // and tagged with its EngagementSource.
  getTweetReplies(tweetId: string, limit: number): Promise<EngagedAccountRaw[]>;   // source REPLY
  getTweetQuotes(tweetId: string, limit: number): Promise<EngagedAccountRaw[]>;    // source QUOTE
  getTweetRetweeters(tweetId: string, limit: number): Promise<EngagedAccountRaw[]>; // source RETWEET

  // Followers of a handle (not tied to a tweet) -> plain users.
  getFollowers(handle: string, limit: number): Promise<TwitterUser[]>;

  // Present for interface completeness; minimal in the mock (no discovery yet).
  searchTweets(query: string, limit: number): Promise<Tweet[]>;
}
```

Design notes:

- **Return-shape choices:** engagement-on-a-tweet methods return `EngagedAccountRaw[]` (`{ user, tweetId, source }`) because audience classification needs the *engaging account's* `TwitterUser` (bio/handle are the classification signal), tied to the tweet and source. `getFollowers` returns `TwitterUser[]` (followers aren't tied to a tweet, so `EngagedAccountRaw` — which requires `tweetId` — doesn't fit). Reply/quote *text* is not part of these returns this unit; if engagement-quality analysis later needs it, the interface (and a shared type) is extended in that unit — not now (don't overbuild).
- **Not-found:** `getUserProfile` returns `null` rather than throwing, so a missing org/KOL degrades confidence rather than crashing (Invariant 8). List methods return `[]` when there's nothing.
- **`limit`:** every list method respects `limit` (returns at most `limit`, sliced deterministically). Callers pass the `ANALYSIS_CAPS` values (`kolPostsFetched`, `repliesPerPost`, etc.); the mock may return fewer than the cap.
- **Errors:** the interface itself defines no error type; the *live* provider (Unit 16) maps provider errors to internal codes. The mock does not throw for normal inputs.

## Normalized Data Shapes

Reuse the shared schemas/types verbatim — this unit adds **no** new shared types:

- `TwitterUser` — `{ id, handle, displayName?, bio?, followersCount?, followingCount?, tweetCount?, verified?, createdAt?, avatarUrl? }`.
- `Tweet` — `{ id, authorId?, authorHandle?, text, createdAt?, likeCount?, retweetCount?, replyCount?, quoteCount?, viewCount?, isReply?, isQuote?, lang? }`.
- `EngagedAccountRaw` — `{ user: TwitterUser, tweetId, source: EngagementSource }` where `EngagementSource ∈ { REPLY, QUOTE, RETWEET, FOLLOWER }`.

The mock's output must **validate** against `TwitterUserSchema` / `TweetSchema` / `EngagedAccountRawSchema` (checked in verification). Only compact metadata, no raw payloads (Invariant 15).

## Mock Data Design

The mock is a pure, deterministic fixture source — **no `Math.random()` without a seed, no `Date.now()`**; identical args → deep-equal output every call. This makes it reliable for Unit 13 pipeline tests.

- **Profiles (`getUserProfile`):** deterministic per handle. A couple of richer "known" fixtures (a plausible org and a plausible KOL) plus a stable hash-derived fallback for any other handle (so tests can pass arbitrary handles). `id` derived deterministically from the handle (e.g. `mock:<handle>`), stable `displayName`/`bio`/counts, fixed `createdAt`.
- **KOL posts (`getUserTweets`):** a deterministic set of tweets with **varied engagement counts** (so later top-post selection by engagement is meaningful) and stable ids/timestamps. Provide enough (e.g. ~20–40, up to the requested `limit`) — no need to synthesize the full 100-cap.
- **KOL replies (`getUserReplies`):** a small deterministic set with `isReply: true`.
- **Engaged accounts pool (`getTweetReplies` / `getTweetQuotes` / `getTweetRetweeters`):** a fixed pool of distinct accounts spanning audience-bucket signals, sampled deterministically per `tweetId` (stable subset per tweet + source), each tagged with the right `source`. The **variety must cover at least** (bios/handles chosen so later classification has signal):

  | Signal in fixture | Example bio / handle cue |
  | --- | --- |
  | developers | "solidity dev, building on L2", handle like `0xbuilder` |
  | founders | "founder @somechain, ex-YC" |
  | DeFi users | "LP on curve/uni, yield farmer (the real kind)" |
  | traders | "perps degen, funding-rate enjoyer 📈" |
  | airdrop farmers | "airdrop hunter 🪂 farming every testnet" |
  | meme coin users | "wen moon 🚀🚀, $PEPE maxi" |
  | bots / spam-like | empty/near-empty bio, handle like `user8372641`, low followers, generic text |

  Retweeters carry no text (amplification only); replies/quotes are engaging accounts tied to the tweet. Pool size ~15–20 distinct accounts is plenty — the mock returns deterministic subsets, not thousands.
- **Followers (`getFollowers`):** a deterministic slice of the same/related account pool as `TwitterUser[]`.
- **`searchTweets`:** minimal and deterministic — a small fixed set (or empty). Not exercised by the known-KOL flow; present only for interface completeness.
- **Determinism mechanism:** a tiny seeded helper (e.g. a string-hash → index) selects stable subsets from the fixture pools by `handle`/`tweetId`; document it so Unit 13 can rely on stable outputs.

Keep fixtures modest and readable — enough variety to be useful, not a giant dataset.

## Configuration / Provider Selection Behavior

A factory provides the selection seam so Unit 16 can swap in the live provider without touching callers:

```ts
export type TwitterProviderKind = "mock" | "twitterapi";

export function createTwitterProvider(
  options?: { kind?: TwitterProviderKind }
): TwitterProvider;
```

- Resolution order: `options.kind` → `process.env.TWITTER_PROVIDER` → default `"mock"`.
- `"mock"` → returns the `MockTwitterProvider`.
- `"twitterapi"` → throws a clear `Error("TwitterAPI.io provider is not implemented yet (Unit 16).")` for now (the branch is wired in Unit 16). This makes the seam explicit without a live dependency.
- The mock is also exported directly (e.g. `MockTwitterProvider` / `createMockTwitterProvider()`) so Unit 13 tests can construct it without env.
- **Env var:** add `TWITTER_PROVIDER` to `.env.example` (commented, optional, default `mock`). It is optional and defaulted, so nothing breaks when unset.

All of this lives inside `packages/twitter`; no Twitter-specific logic leaks elsewhere.

## Implementation Steps

1. **Deps for `packages/twitter`:** add `@kol-fit/shared` (`workspace:*`) and `@types/node` (dev, for `process.env` in the factory). Add `"types": ["node"]` to `packages/twitter/tsconfig.json` (repo convention). No `zod` direct dep — reuse the shared schemas for validation.
2. **`src/provider.ts`** — the `TwitterProvider` interface, `TwitterProviderKind`, and `createTwitterProvider(options?)` factory (resolution order above; `"twitterapi"` throws the not-implemented error).
3. **`src/mock/fixtures.ts`** — deterministic fixture pools: org/KOL profiles, KOL posts/replies, and the varied engaged-account pool (bucket-signal table above), with the seeded selection helper. Fixed ids/timestamps.
4. **`src/mock/provider.ts`** — `MockTwitterProvider implements TwitterProvider`, all 8 methods reading from fixtures, respecting `limit`, deterministic per args.
5. **`src/index.ts`** — barrel: export the interface + `TwitterProviderKind`, `createTwitterProvider`, and the mock provider. Replace the `PACKAGE_NAME` placeholder (nothing imports it).
6. **`.env.example`** — add the optional `TWITTER_PROVIDER=mock` line with a short comment.
7. **Do not touch** `apps/*`, other `packages/*`, or the Prisma schema.

## Dependencies

- New workspace dep on `packages/twitter`: `@kol-fit/shared`.
- New dev dep: `@types/node` (for `process.env`).
- **No** new npm runtime packages (no HTTP client, no TwitterAPI.io SDK — that's Unit 16); no `zod` direct dep (shared schemas reused for validation).
- Explicitly not introduced: any network/HTTP library, provider SDK.

## Verification Checklist

All checks are **offline and disk-light** (no DB, no Postgres, no browser — just `pnpm build` + small `node -e` against the built package):

- [ ] `pnpm build` passes across all workspace projects (`packages/twitter` compiles; nothing else changes).
- [ ] From built `dist`, the mock provider's outputs **validate** against the shared schemas: `getUserProfile` → `TwitterUserSchema`; `getUserTweets`/`getUserReplies`/`searchTweets` → `TweetSchema[]`; `getTweetReplies`/`getTweetQuotes`/`getTweetRetweeters` → `EngagedAccountRawSchema[]` (with the right `source`); `getFollowers` → `TwitterUserSchema[]`.
- [ ] **Determinism:** two calls with identical args return deep-equal results (e.g. `getUserTweets("kol", 10)` twice; `getTweetReplies("t1", 20)` twice).
- [ ] **`limit` respected:** each list method returns `≤ limit` items.
- [ ] **Not-found:** `getUserProfile` returns a value for known handles; list methods return `[]` for a tweet id with no engagement (or any id, deterministically) without throwing.
- [ ] **Variety:** the engaged-account pool spans the required buckets — assert distinct bios/handles that clearly signal developers, founders, DeFi users, traders, airdrop farmers, meme users, and at least one bot/spam-like account (empty bio + generic handle).
- [ ] **Provider selection:** `createTwitterProvider()` and `createTwitterProvider({ kind: "mock" })` return a working mock; `createTwitterProvider({ kind: "twitterapi" })` throws the clear not-implemented error; `TWITTER_PROVIDER=mock` env resolves to the mock.
- [ ] No network calls occur (mock is pure fixtures; no HTTP client imported).

### Scope guardrails

- [ ] All Twitter/X logic is confined to `packages/twitter`.
- [ ] No worker/pipeline, API route, UI, Prisma schema, LLM, scoring, or pipeline changes; no live TwitterAPI.io.
- [ ] `context/progress-tracker.md` updated once implemented.
- [ ] No commits made.
```
