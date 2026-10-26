#!/usr/bin/env bash
# Purge Cloudflare's edge cache for overlapx.com. Run as root on the VPS right
# after every `systemctl restart overlapx` (DEPLOY.md, "Redeploying").
#
# Why: a Cloudflare Cache Rule caches the agency HTML (/, /work, /work/*,
# /about, /pricing, /contact, /deck; clean URLs only) for a day. A rebuild
# deletes the old /_next/static chunks, so stale cached HTML would point at
# files that no longer exist.
#
# Why everything and not just those URLs: purge-by-URL was tested on
# 2026-10-26 and reported success while the pages stayed cached (age kept
# climbing), likely because Next.js responses vary on request headers that are
# part of the cache key. Purge everything verifiably clears them. The cost is
# that videos and posters are re-fetched from the VPS once per Cloudflare
# location after a deploy.
#
# Needs /root/.cloudflare-overlapx-token (Zone Read, Cache Rules Edit, Cache
# Purge; overlapx.com only). Never commit the token.
set -euo pipefail

ZONE_ID="7d806cdab57a223535695799dd5d7b4d"
TOKEN_FILE="/root/.cloudflare-overlapx-token"

curl -fsS -X POST \
  -H "Authorization: Bearer $(cat "$TOKEN_FILE")" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}' \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("success") else (print(d.get("errors")) or 1))'

echo "purged the Cloudflare edge cache for overlapx.com"
