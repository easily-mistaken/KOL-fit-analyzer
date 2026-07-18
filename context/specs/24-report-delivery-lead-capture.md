# Unit 24: Report Delivery & Lead Capture (email PDF)

> **REMOVED (commit `834ef06`).** Email delivery, the PDF send, and the `MAIL_*`
> env vars no longer exist anywhere in the codebase. The current lead-capture
> funnel is the detailed-report concierge (Unit 35): `/detailed`,
> `DetailedReportRequest`, and the admin `/admin/leads` queue.
> This spec is kept as a historical record of the original design and why it was
> dropped. Do not implement from it.

## Goal

Turn the finished report into a lead-capture moment: the report is viewable on screen, but to **take a copy** the user hands over their **email and/or Telegram**, we **store it** (a lead), and — for email — we **send them a PDF of the report**. Telegram is captured and stored now; actual Telegram delivery is deferred (platform constraint below).

Not a gate on *viewing* (they just ran the analysis) — a gate on *keeping/sharing* a copy.

## Deliverable: a PDF (not a link)

A link would just reopen the same web view, so the artifact is a **generated PDF** — a branded, keepable document. Rendered with **`@react-pdf/renderer`** (pure JS, no headless browser) from the saved `FitReport`, in the Morpho palette:

- Header: org vs KOL, verdict + overall score, confidence, generated date.
- Key takeaways (bullets).
- Score breakdown — the 9 metrics as labeled bars/values (react-pdf `Svg`/rects), grouped Fit vs Risk with weights.
- Audience breakdown — a table of the 15 buckets with shares, low-quality flagged.
- Recommendation, content/engagement, risk narratives, evidence & sample.

Not pixel-identical to the web (interactive gauge/donut → static bars/table) — a clean document rendition. (Alternative considered: Puppeteer screenshot of the live page — pixel-perfect but pulls a ~300 MB Chromium and must load the page; rejected for weight/fragility. Flagged in Open Questions.)

## Data model (Prisma) — one additive model

```prisma
model ReportDelivery {
  id          String  @id @default(cuid())
  reportId    String
  requestId   String?
  workspaceId String?

  email          String?
  telegramHandle String?

  emailStatus    DeliveryStatus @default(PENDING)   // PENDING|SENT|FAILED|SKIPPED
  telegramStatus DeliveryStatus @default(PENDING)

  sentAt       DateTime? @db.Timestamptz
  errorCode    String?
  errorMessage String?
  createdAt    DateTime  @default(now()) @db.Timestamptz

  report  Report          @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@index([reportId])
  @@index([email])
  @@index([createdAt])
}

enum DeliveryStatus { PENDING SENT FAILED SKIPPED }
```

One row per capture event, doubling as the **leads table** (query by `email`/`createdAt`). `SKIPPED` = channel not provided (or Telegram, which we store but don't send yet). Additive; applied via `prisma db push` (confirm the schema addition, per standing rule).

## Mail provider abstraction (mock-first, like Twitter/LLM)

New `packages/mail`: a `MailProvider` interface (`send({ to, subject, html, text, attachments })`) + a factory selecting by env:
- **mock** (default) — logs the send + attachment size, returns success. No credentials, works end-to-end offline.
- **resend** — real send via Resend (`RESEND_API_KEY`, `MAIL_FROM`). Errors mapped to a small typed set. No real send until configured; **never send without the key + explicit enablement.**

Kept provider-agnostic so SMTP/SendGrid can slot in later.

## Queue + worker

- New pg-boss queue `report.deliver`; payload `{ deliveryId }` (Zod-validated).
- API enqueues it **only when an email was provided** (Telegram alone → no send job; row stored with `telegramStatus = SKIPPED`, `emailStatus = SKIPPED`).
- Handler `processReportDelivery`: load the `ReportDelivery` + its `Report`; idempotent (skip if `emailStatus === SENT`); generate the PDF from `report.report` (validated `FitReportSchema`); `mail.send(... attachments:[{ filename, content: pdfBuffer }])`; set `emailStatus = SENT`/`sentAt` or `FAILED` + safe `errorCode/message` (reuse the Unit-21 safe-logging discipline — never log the address beyond what's needed, never log provider secrets). Per-job isolation like the analysis handler.

## API route

`POST /api/analyses/[id]/deliver` (thin, `runtime nodejs`):
- Body `{ email?: string; telegramHandle?: string }` — Zod: at least one present; email format-checked; telegram handle normalized (`@` optional, basic charset).
- Load the request's `Report`; must exist and be `COMPLETED` → else `err("not_found"/"conflict")`.
- Create the `ReportDelivery` row (email/telegram, statuses: email→PENDING if given else SKIPPED; telegram→SKIPPED-for-now if given else SKIPPED).
- If email given → `enqueue report.deliver`. Return `ok({ id, emailQueued, telegramCaptured })`. Never leak errors.

## UI

`components/report/get-report.tsx` (client) — a card in the completed report (e.g., below the hero or in a sticky "Get the full report" panel):
- Two inputs — **Email** and **Telegram** (both optional; inline validation; "enter at least one").
- Primary button "Email me the report" (or "Send my report"). On submit → `POST …/deliver` → success state: *"Your report is on its way to <email>."* / *"We've saved your Telegram — delivery there is coming soon."* Handles the API error shape.
- Small privacy line ("We'll only use this to send your report.").

## Environment

- `MAIL_PROVIDER` (default `mock`), `RESEND_API_KEY`, `MAIL_FROM` (verified sender), optional `MAIL_REPLY_TO`. Documented in `.env.example`. No secrets committed; real email only when set.

## Error handling

- Delivery/send failures → `emailStatus = FAILED` + safe `errorCode/message`; the lead row is preserved (never lose a captured contact). Job errors isolated + swallowed (batch-safe).
- Invalid/oversized input → validation error from the route; the report view stays intact.
- Mock provider never fails; real provider errors are mapped, logged safely (no address/secret leakage).

## Implementation Steps

1. Schema: `ReportDelivery` + `DeliveryStatus`; `prisma db push` (confirm). Add the `ReportDelivery` relation to `Report`.
2. `packages/mail`: `MailProvider` interface + mock + resend (behind env) + factory; typed errors.
3. `packages/report-pdf` (or `apps/worker` local): `renderReportPdf(fitReport, meta): Promise<Buffer>` using `@react-pdf/renderer` — the branded `ReportPdf` document.
4. Queue: `report.deliver` name + payload schema + enqueue helper.
5. Worker: `processReportDelivery` handler; register it alongside `analysis.run`.
6. API: `POST /api/analyses/[id]/deliver`.
7. UI: `get-report.tsx` + slot it into the completed report; DTO/status untouched.
8. `.env.example`, `context/architecture.md` (delivery flow + leads), `progress-tracker.md`.
9. Regression check (offline): PDF renders a non-empty valid PDF from a fixture `FitReport`; mock mail "sends"; API validation (≥1 channel, email format); wired into `pnpm check`.

## Dependencies

- **`@react-pdf/renderer`** (+ `react` in the pdf module) — server-side PDF, no browser binary.
- **`resend`** — added only when enabling real email (mock needs no dep). No other new deps.
- Reuses `@kol-fit/db`, `@kol-fit/queue`, `@kol-fit/shared`.

## Verification

Offline (`pnpm build` + `pnpm check`):
- [ ] Build + checks green (incl. new PDF/mail check).
- [ ] `renderReportPdf(fixture)` returns a valid non-empty `%PDF` buffer; degrades gracefully on a sparse report.
- [ ] Mock mail `send` logs + returns success; API rejects empty submissions and bad emails, accepts email-only / telegram-only / both.

Online (disk-light, local Postgres, mock mail — no real send):
- [ ] `POST …/deliver` with an email → `ReportDelivery` row created (`emailStatus PENDING`), job enqueued, handler runs → `emailStatus SENT`, `sentAt` set; PDF generated (size logged).
- [ ] Telegram-only → row stored (`telegramStatus SKIPPED`, no job); email-only and both behave correctly.
- [ ] Leads are queryable by `email`.

Optional live (real Resend key + verified sender + explicit approval, never CI): one real email with the PDF attached — manual.

Scope guardrails:
- [ ] Only the additive `ReportDelivery`/`DeliveryStatus` schema (confirmed first); pipeline/scoring/providers untouched.
- [ ] No real email without `MAIL_PROVIDER=resend` + key + approval; mock is the default.
- [ ] Telegram captured/stored only (no send) this unit; constraint documented.
- [ ] `progress-tracker.md` + `architecture.md` updated. One commit after verification.

## Open Questions / Decisions (recommended defaults in place)

- **PDF engine:** `@react-pdf/renderer` (recommended — no browser) vs Puppeteer (pixel-perfect, heavy). Recommend react-pdf.
- **Email provider:** Resend (recommended — simple API, generous free tier) vs SMTP/SendGrid. Abstraction supports any; recommend Resend.
- **Telegram delivery:** deferred (needs a bot + the user pressing Start). Capture now, deliver in a later unit — confirm.
- **Gate strength:** capture is optional (report stays fully visible) vs blurring part of the on-screen report until they submit. Recommend keep it fully visible + offer the PDF (less user-hostile); confirm if you want a harder gate.
