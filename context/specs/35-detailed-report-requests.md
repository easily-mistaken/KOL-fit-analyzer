# Unit 35: Detailed-Report Requests (concierge lead capture)

User direction (2026-07-16, clarified): the curated detailed analysis is a
**standing alternative path, available at any time** — not only the post-12
wall. Anyone can either run the self-serve analysis (tiered, Unit 34) or
raise a request by sharing their **Telegram** and **X handle/link**; the
curated report is prepared manually by the operator and delivered to their
Telegram within a day. Requests land in the admin panel; fulfillment is
manual (confirmed).

## Entry points

1. Standalone page `/detailed` (org/KOL fields optional — a request can
   precede any self-serve run).
2. CTA on every completed report ("Get this analysis curated") — prefills
   the pair + links the analysis.
3. Secondary link on the analysis form ("Prefer a hands-on review?").
4. The Unit 34 upgrade wall's button.

## Data & API

- New Prisma model `DetailedReportRequest`: ownerId, userId?,
  analysisRequestId?, orgHandle?, kolHandle?, telegram, xHandle, note?,
  status enum `DetailedRequestStatus (NEW | SENT | DISMISSED)`, createdAt,
  fulfilledAt?. Additive — applied via `prisma db push`.
- Shared `DetailedReportRequestInputSchema` with normalizers: telegram
  strips `@`/`t.me/` and validates the username shape; xHandle accepts a
  bare handle or an x.com/twitter.com URL and normalizes to the handle.
- `POST /api/detailed-requests` (public, owner-cookie scoped): validate,
  attach userId when signed in, per-owner cap
  (`MAX_DETAILED_REQUESTS_PER_OWNER_PER_DAY`, default 3/rolling 24h), create.
- `PATCH /api/admin/detailed-requests` (admin-gated): status transitions
  (SENT sets fulfilledAt; DISMISSED).

## Admin

`/admin/detailed` page + nav entry: newest-first queue showing pair, links
to the analysis/report when present, Telegram (t.me link), X handle
(x.com link), note, status buttons (Mark sent / Dismiss). Read patterns
mirror `/admin/leads`.

## Verification

`pnpm build`; `detailed-requests.regression.cjs` (normalization: @ strips,
t.me/x.com URL extraction, shape validation, note cap, optional pair
handles); `prisma db push` applied; manual walk (submit → admin queue →
mark sent) by the user.
