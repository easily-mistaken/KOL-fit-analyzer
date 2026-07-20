# Unit 39: Funnel Polish (quota visibility, ready-notification, requester ack)

User-approved improvement #3 — three small conversion/trust fixes:

1. **Quota indicator.** Users currently discover the tier wall by slamming
   into it. New `GET /api/analyses/quota` (reads the same lifetime count the
   tier gate uses — refactored into a shared helper so Unit 40's
   failed-runs-don't-count fix applies to both automatically) → the analysis
   form shows a quiet line near the submit button: "2 of 3 free analyses
   left" (anonymous) / "7 of 10 analyses left" (signed in). Uses `getOwnerId`
   (never sets a cookie on read); hides silently on any error.
2. **Report-ready tab notification.** Analyses take ~2 minutes; people tab
   away. When polling flips to COMPLETED (or FAILED) while the tab is
   hidden, the document title flashes "✅ Report ready" / "⚠️ Analysis
   failed" until the user returns. Dependency-free (no Notification API
   permission prompts).
3. **Requester acknowledgment.** The concierge success card gains a
   t.me deep link — "Open @<bot> and tap Start so your curated report can
   reach you directly" (Telegram bots cannot DM first; this closes the
   delivery loop). Bot username from `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
   (public, non-secret); button hidden when unset.

## Verification

`pnpm build`; manual: form shows the counter and it decrements after a run;
tab-away during an analysis → title flash; concierge success card shows the
bot button when the env var is set.
