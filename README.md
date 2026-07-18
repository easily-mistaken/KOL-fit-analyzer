# OverlapX

Compares a crypto organization against a Twitter/X KOL and produces a deep fit
report: whether the KOL's **actually engaged audience** overlaps with the org's
target audience and campaign goal.

> We don't just check what a KOL posts. We check who actually listens.

A KOL can have high impressions and still be a bad fit if the wrong people are
listening. So the primary metric is **Engaged Audience Match**: among the people
who actually reply to, quote, and retweet this KOL, how many look like the
organization's target users? The report also flags brand, bot, farming, and
paid-promo risk.

Internal-first: the current user is the operator evaluating KOLs for crypto
campaigns.

## How it runs

One Next.js app plus one pg-boss worker, both started by a single process
(`pnpm start` -> `scripts/start.mjs`). Everything (accounts, analyses, cache,
job queue) lives in one Supabase Postgres. There is no separate backend, no
Redis, no second database.

The worker is a separate process because a full analysis takes ~5-7 minutes,
which cannot run inside a request handler.

## Local development

```
pnpm install
cp .env.example .env     # fill in the values, see notes inline
pnpm dev:web             # Next.js on :3000
pnpm dev:worker          # pg-boss worker
```

`pnpm start` runs the production one-process setup locally, useful for
smoke-testing before a deploy.

## Checks

```
pnpm -r build            # build every workspace package
pnpm check               # regression suites (scoring, caching, auth, limits, ...)
```

## Where things live

| Path | What |
|------|------|
| `apps/web` | Next.js app: UI, API routes, admin panel |
| `apps/worker` | pg-boss worker that runs the analysis pipeline |
| `packages/analysis` | the pipeline: fetch, engagement, classification, scoring |
| `packages/scoring` | deterministic scoring, metrics, verdicts |
| `packages/twitter`, `packages/llm` | provider abstractions (live + mock) |
| `packages/shared` | canonical Zod schemas and types |
| `scripts/checks` | regression suites run by `pnpm check` |

## Docs

- `DEPLOY.md` — deployment, env vars, post-deploy checklist
- `context/` — product definition, architecture, standards, and the build log.
  `context/specs/` is a historical record; specs for removed features carry a
  banner saying so.
