# Deploying OverlapX

OverlapX deploys as **one service, one container**: a single process (`pnpm start`)
runs both the Next.js web server and the pg-boss worker as child processes (see
`scripts/start.mjs`). If either dies, the container exits so the platform
restarts it — there's never a half-up state.

Everything (accounts, analyses, cache, job queue) lives in **one Supabase
Postgres**. There is no separate backend, no Redis, no second database.

## Where to deploy

Any host that runs an **always-on process** works: a VPS (see *Deploying on a
VPS* below), Railway, Render, Fly.io, etc. **Not plain Vercel serverless** — the
worker needs a process that stays alive to drain the queue (a 5–7 min analysis
can't run in a serverless function).

- **Build command:** `pnpm install --frozen-lockfile && pnpm -r build`
- **Start command:** `pnpm start`
- **Node:** 20+ (uses the workspace `pnpm@9` + Node ESM).

One instance is enough. Scaling to N instances just runs N workers; pg-boss lets
multiple workers share the queue safely.

## Deploying on a VPS (systemd)

On a managed platform (Railway/Render/Fly) the platform restarts a container
that exits. **A bare VPS has nothing doing that**, and `scripts/start.mjs`
deliberately exits when either child dies. Without a supervisor, one worker
crash takes the whole app down until someone logs in. systemd is the supervisor.

### One-time host setup

```bash
# Node 20+ (Debian/Ubuntu, via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm 9 installed globally, so systemd can find it on PATH
sudo npm install -g pnpm@9

# a non-root user to run the app
sudo adduser --system --group --home /srv/overlapx overlapx
```

Put the checkout at `/srv/overlapx`, owned by that user, then build:

```bash
sudo -u overlapx pnpm install --frozen-lockfile
sudo -u overlapx pnpm -r build
```

### The unit file

`/etc/systemd/system/overlapx.service`:

```ini
[Unit]
Description=OverlapX (Next.js web + pg-boss worker)
After=network-online.target
Wants=network-online.target

# Don't let a crash-loop hammer the DB: give up after 5 restarts in 60s so the
# failure is visible in `systemctl status` instead of silently thrashing.
# These belong in [Unit], not [Service] - systemd moved them in v229 and
# ignores them (with an "Unknown lvalue" warning) if left under [Service].
StartLimitBurst=5
StartLimitIntervalSec=60

[Service]
Type=simple
User=overlapx
Group=overlapx
WorkingDirectory=/srv/overlapx

# systemd gives a near-empty PATH. start.mjs spawns `pnpm --filter web start`,
# so pnpm MUST be resolvable here or the web child dies instantly. This is the
# single most common reason the unit fails on a fresh box.
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=NODE_ENV=production

# Config: either keep /srv/overlapx/.env (start.mjs loads it), or use an
# EnvironmentFile below. Real env always wins - start.mjs never overrides it.
# EnvironmentFile=/etc/overlapx.env

ExecStart=/usr/bin/node scripts/start.mjs

# The whole point: start.mjs exits fail-fast, systemd brings it back.
Restart=always
RestartSec=5

StandardOutput=journal
StandardError=journal
SyslogIdentifier=overlapx

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now overlapx
sudo systemctl status overlapx
sudo journalctl -u overlapx -f      # live logs from both processes
```

Verify the supervision actually works before trusting it:

```bash
# kill the worker child; systemd should bring the whole unit back within ~5s
sudo pkill -f 'apps/worker/dist/index.js'
sudo systemctl status overlapx
```

### Reverse proxy + TLS

`pnpm start` serves plain HTTP on :3000. Put nginx (or Caddy) in front so
`NEXT_PUBLIC_APP_URL` can be `https://…` — Supabase Google sign-in redirects to
that origin, so it must be the real public HTTPS URL, not the IP.

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

nginx server block, proxying to the app:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

### Firewall

Only 80/443 should be public. Port 3000 must not be reachable from outside, or
the app is served over plain HTTP bypassing TLS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Redeploying

```bash
cd /srv/overlapx
sudo -u overlapx git pull
sudo -u overlapx pnpm install --frozen-lockfile
sudo -u overlapx pnpm -r build
sudo systemctl restart overlapx
```

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
| `ADMIN_PASSWORD` | optional; leave empty to keep the admin panel disabled |
| `MAX_DAILY_SPEND_USD`, `MAX_ANALYSES_PER_*` | cost/abuse caps |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID` | **private** bot that DMs *you* when a lead lands; never shown to users |
| `NEXT_PUBLIC_CONTACT_TELEGRAM`, `NEXT_PUBLIC_CONTACT_X` | your handles, shown on finished reports |

## Post-deploy checklist

1. **Supabase → Auth → URL Configuration:** add `NEXT_PUBLIC_APP_URL` as a Site
   URL and add `<app-url>/auth/callback` to the redirect allowlist. Google
   sign-in fails without this.
2. **Google provider** must be enabled in the Supabase dashboard (Google Cloud
   OAuth client configured).
3. **Schema:** this project has **no migration history** — `packages/db/prisma/`
   contains only `schema.prisma`, and every schema change so far was applied
   with `prisma db push`. `prisma migrate deploy` would be a no-op, so use:

   ```bash
   pnpm --filter @kol-fit/db exec prisma db push
   ```

   against `DIRECT_URL` when the schema changed. (The `db:deploy` script in
   `packages/db/package.json` exists but is unused until a baseline migration
   is generated.)
4. **Fresh production data:** the production database is the existing Supabase
   project, which still holds dev/test rows. Purge them before going live —
   otherwise `/admin/leads` shows fake leads and the daily cost/abuse counters
   (`MAX_ANALYSES_PER_DAY`, `MAX_DAILY_SPEND_USD`) start partly consumed.
   Cached provider data is safe to leave: cache keys are namespaced by provider
   kind (`tw:v2:<kind>:`), so live runs can never be served mock fixtures.

## Local development

Deployment is one process; local dev stays two terminals:

```
pnpm dev:web      # Next.js on :3000
pnpm dev:worker   # pg-boss worker
```

`pnpm start` (the production command) also works locally for smoke-testing the
one-container setup — it loads `.env` and runs both processes together.
