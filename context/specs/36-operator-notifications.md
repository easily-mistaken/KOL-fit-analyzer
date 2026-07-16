# Unit 36: Operator Notifications (new detailed-report requests → Telegram)

The Unit 35 concierge tier promises delivery "within a day", but requests
only appear in the admin queue — the operator would have to poll. This unit
pings the operator's own Telegram the moment a request lands.

## Design

- `apps/web/lib/notify.ts`: `notifyOperator(text)` — POST to the Telegram
  Bot API (`sendMessage`) using `TELEGRAM_BOT_TOKEN` +
  `TELEGRAM_ADMIN_CHAT_ID`. **Fire-and-forget**: 5s timeout, all errors
  swallowed (a notification failure must never fail the user's request);
  silent no-op when either env var is unset. The token is only ever used in
  the URL path per Telegram's API shape and never logged.
- `POST /api/detailed-requests` calls it after a successful create with a
  compact summary: pair (when given), Telegram + X handles, first 120 chars
  of the note, and a link to `/admin/detailed` (via `NEXT_PUBLIC_APP_URL`).
- Message content is operator-facing (it's the operator's own bot/chat).

## Operator setup (one-time, manual)

1. Create a bot with @BotFather → copy the token → `TELEGRAM_BOT_TOKEN`.
2. Send the bot any message, then read the chat id from
   `https://api.telegram.org/bot<token>/getUpdates` →
   `TELEGRAM_ADMIN_CHAT_ID`.

## Verification

`pnpm build`; env unset ⇒ verified no-op (no fetch attempted — guard is
before any network call); live verification is the operator's: set both env
vars, submit a request, receive the DM. (No .cjs regression: the logic lives
in the Next app which has no requireable dist; the guard + swallow paths are
trivial and build-checked.)
