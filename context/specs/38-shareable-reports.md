# Unit 38: Shareable Report Links

User-approved improvement #2: a completed report can be shared via a public
read-only link — agencies show colleagues/clients, and every shared report
becomes a funnel entry (the public page carries a "run your own analysis"
CTA). Owner scoping (Unit 25) stays intact for the normal report route; the
share link is an explicit, revocable capability token.

## Design

- `Report.shareToken String? @unique` (additive `db push`). Generated on
  demand (`crypto.randomBytes(16)` base64url ≈ 128 bits — unguessable),
  removable (revoke sets it null; the old URL dies).
- `POST /api/analyses/[id]/share` (owner-only, same 404-for-strangers
  pattern as the report route): returns the token, creating it if absent.
  `DELETE` revokes. Only COMPLETED reports are shareable.
- Public page `/r/[token]`: server-rendered, `force-dynamic`, `noindex`.
  Looks up by token; 404 when absent/revoked/not-completed. Renders the
  same (already client-redacted) `FitReportView` in a new `mode="public"`:
  no back-link to the owner's report list; instead a branded banner —
  "Generated with <app>. Analyze your own KOL →" — plus the concierge CTA
  (shared reports are lead-gen).
- Owner report page gains a Share button (client): creates the link, copies
  it to the clipboard, offers revoke.

## Verification

`pnpm build`; manual walk: share → open in incognito (renders without a
session) → revoke → link 404s. No scoring/pipeline changes; token never
appears in any list/API other than the owner share endpoint.
