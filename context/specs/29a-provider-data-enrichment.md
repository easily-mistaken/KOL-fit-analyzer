# Unit 29A: Provider Data Enrichment (reply/quote text, media, repeat engagers)

Part of the Unit 29 accuracy overhaul (`29-analysis-accuracy-overhaul.md`).
Goal: carry the high-signal data we already receive (and currently discard)
into the pipeline, so 29B (LLM classification v2) and 29C (scoring v2) have
something to work with. No prompt, scoring, or pipeline-flow changes here.

## Scope

### 1. Shared schema (additive optional only)

`packages/shared/src/twitter.ts`:

- New `TweetMediaSchema`: `{ type: "photo"|"video"|"animated_gif",
  url?: string, previewUrl?: string }`; `Tweet` gains `media?: TweetMedia[]`.
- `EngagedAccountRaw` gains:
  - `text?: string` — the reply/quote body (absent for retweets), truncated
    to 500 chars at normalization, lone UTF-16 surrogates stripped (slice can
    split an emoji; Postgres jsonb + OpenAI both reject lone surrogates).
  - `appearances?: number` (int ≥ 1) — how many analyzed posts this account
    engaged with (set by `collectEngagedAccounts`).

Old payloads (saved reports, cached values) remain valid — all fields optional.

### 2. TwitterAPI.io provider

`packages/twitter/src/twitterapi/normalize.ts`:

- `normalizeTweet` maps `extendedEntities.media` (fallback `entities.media`):
  `type` (photo/video/animated_gif, else skip item), `url`/`previewUrl` from
  `media_url_https` (for video this IS the thumbnail — v1.1 semantics).
  Defensive: invalid items skipped; empty → field omitted.
- `normalizeEngaged` gains an optional `text` param (bounded + sanitized as
  above).

`packages/twitter/src/twitterapi/provider.ts`: `getTweetReplies` /
`getTweetQuotes` pass the raw reply/quote tweet's `text` into
`normalizeEngaged` (the data was already in the response; we only kept the
author). Retweeters unchanged (no text exists).

### 3. Mock provider

Fixtures gain per-account `replyText` matching the bucket signal (substantive
for devs/founders, "wen airdrop ser" for farmers, "🚀🚀🚀"/giveaway-claim spam
for bots) so 29B/29C are testable offline; REPLY/QUOTE engagers carry text,
RETWEET does not. A few post templates gain deterministic `media` fixtures
(chart photo on analysis posts, one meme image, one video) with stable fake
URLs. Determinism preserved (no randomness).

### 4. Repeat-engager counting

`packages/analysis/src/pipeline/collect-engagement.ts`: dedupe keeps the first
occurrence (source unchanged) but now counts duplicates into `appearances` on
the kept account. Counting continues after the `maxUnique` cap is hit (pure
in-memory; only *adding new* accounts stops), so repeat-engager evidence is
not order-truncated.

### 5. Twitter cache namespace bump

`packages/cache/src/twitter-cache.ts`: `KEY_PREFIX` `tw:v1` → `tw:v2` so
pre-enrichment cached payloads (no text/media) can't silently starve a v2
analysis within the TTL window. (LLM `cls:` namespace bumps in 29B, when
classification inputs actually change.)

## Explicitly out of scope

Prompt changes, audience-classification input changes, scoring changes,
pipeline parallelism, caps changes (29B/29C/29D).

## Verification

- `pnpm build` green.
- New `scripts/checks/data-enrichment.regression.cjs` wired into `pnpm check`:
  media normalization (photo/video mapped, junk skipped, absent omitted);
  engaged text carried/truncated/surrogate-safe; live-provider reply text via
  injected fetch; mock text-by-source + media + determinism; `appearances`
  counting incl. past-cap and cap/dedupe behavior unchanged; backward-compat
  parse of old-shaped payloads.
