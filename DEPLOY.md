# Deploying OverlapX

OverlapX deploys as **one service, one container**: a single process (`pnpm start`)
runs both the Next.js web server and the pg-boss worker as child processes (see
`scripts/start.mjs`). If either dies, the container exits so the platform
restarts it — there's never a half-up state.

Everything (accounts, analyses, cache, job queue) lives in **one Supabase
Postgres**. There is no separate backend, no Redis, no second database.

## Where to deploy

Any host that runs an **always-on container** works: Railway, Render, Fly.io, a
VM, etc. **Not plain Vercel serverless** — the worker needs a process that stays
alive to drain the queue (a 5–7 min analysis can't run in a serverless function).

- **Build command:** `pnpm install --frozen-lockfile && pnpm -r build`
- **Start command:** `pnpm start`
- **Node:** 20+ (uses the workspace `pnpm@9` + Node ESM).

One instance is enough. Scaling to N instances just runs N workers; pg-boss lets
multiple workers share the queue safely.

## Required environment variables

Set these in the platform's env settings (not a committed file). See
`.env.example` for the full list and inline notes; the deploy-critical ones:

| Var | Notes |
|-----|-------|
| `DATABASE_URL` | Supabase **pooled** connection (port 6543) — app queries |
| `DIRECT_URL` | Supabase **direct** connection (port 5432) — migrations + pg-boss |
| `NEXT_PUBLIC_SUPABASE_URL` | enables Google sign-in (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | enables Google sign-in (public) |
| `NEXT_PUBLIC_APP_URL` | the deployed origin, e.g. `https://overlapx.com` |
| `TWITTER_PROVIDER=twitterapi` + `TWITTERAPI_IO_KEY` | live X data |
| `LLM_PROVIDER=openai` + `OPENAI_API_KEY` | live analysis |
| `MAIL_PROVIDER` + `RESEND_API_KEY` + `MAIL_FROM` | set to `resend` for real report delivery (default `mock` sends nothing) |
| `ADMIN_PASSWORD` | optional; leave empty to keep the admin panel disabled |
| `MAX_DAILY_SPEND_USD`, `MAX_ANALYSES_PER_*` | cost/abuse caps |

## Post-deploy checklist

1. **Supabase → Auth → URL Configuration:** add `NEXT_PUBLIC_APP_URL` as a Site
   URL and add `<app-url>/auth/callback` to the redirect allowlist. Google
   sign-in fails without this.
2. **Google provider** must be enabled in the Supabase dashboard (Google Cloud
   OAuth client configured).
3. **Migrations:** run `pnpm --filter @kol-fit/db exec prisma migrate deploy`
   against `DIRECT_URL` if the schema changed.
4. **Fresh production data:** the current Supabase project holds dev/test data.
   For a clean production start, use a separate Supabase project or purge the
   test rows first.

## Local development

Deployment is one process; local dev stays two terminals:

```
pnpm dev:web      # Next.js on :3000
pnpm dev:worker   # pg-boss worker
```

`pnpm start` (the production command) also works locally for smoke-testing the
one-container setup — it loads `.env` and runs both processes together.
