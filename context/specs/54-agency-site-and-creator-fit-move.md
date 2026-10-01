# Unit 54: OverlapX Agency Site, Creator Fit Move, Brochure

Added 2026-10-01 at the user's request. OverlapX becomes an umbrella brand: the
root of overlapx.com is the OverlapX video agency, and the existing KOL fit tool
moves, unchanged in behavior, to `/creator-fit`. A client-facing brochure ships
alongside the site and shares its visual identity.

## User-locked decisions

- Brand name is simply **OverlapX**. Never positioned under any other company.
- Keep the current logo (`LogoMark` + `Wordmark`) and the acid-lime accent.
- Tool route: **`/creator-fit`**. The tool keeps all functionality.
- Target clients: crypto brands, products, AI products.
- Pricing:
  - Motion Graphics, 30-second video: **$999**
  - AI Video, 1-minute video: **$999**
  - Everything else: **Custom plan** (book a call).
- Payment: **100% after the client loves the video. Nothing upfront.** ("Try us first.")
- Formats: **every format** included.
- **No prices on the home page or in the brochure** (user, 2026-10-02). Prices appear on /pricing only.
- Revisions: **never state a number**. Copy says we refine until it is perfect.
- Turnaround: **4-5 days**.
- Contact:
  - X: https://x.com/tanmayJain5114
  - LinkedIn: https://www.linkedin.com/in/tanmay-jain5/
  - Telegram: tanmayjain5114
  - Email: tanmay@overlapx.com
  - Calendly (primary CTA): https://calendly.com/tanmayjain4477/quick-call
- Team section: **no** (user, 2026-10-02). Do not add one.
- Testimonials: real client chat messages only, verbatim (sentence-case capitalisation allowed), shown as Telegram-style threads with name and company. Source screenshots live in `~/overlapx-assets/testimonials/`.
- Portfolio categories (the user's asset folders): AI, Motion Graphics, Hype,
  Fast Cuts, Others.
- Brochure is required.

## Decisions delegated to Claude

- Agency pages render **dark**, always (video reads best on dark). The tool keeps
  its light default + toggle.
- Primary CTA is Calendly. No contact form in this unit (it would need a schema
  change; deferred).
- Portfolio content lives in a typed data file in the repo (no CMS).
- Video hosting target is Bunny Stream; the data model takes a direct video URL
  and poster, so any host works. Until assets arrive, project slots render as
  clearly-unattributed placeholders (no invented clients, no invented metrics).
- Brochure is built from the same code and data as the site at `/deck` (hidden,
  `noindex`) and exported to a 16:9 PDF with headless Chrome
  (`scripts/export-deck.mjs`), served at `/overlapx-deck.pdf`.
- Analytics (Umami) deferred.

## Routes

| Path | What |
| --- | --- |
| `/` | Agency home |
| `/work`, `/work?style=<category>` | Portfolio, filterable by category |
| `/work/[slug]` | Project page: Client, Objective, Video, Result |
| `/pricing` | Plans + FAQ |
| `/about` | Why X, how we work, team (when supplied) |
| `/contact` | Calendly embed + X, Telegram, LinkedIn, email |
| `/deck` | Brochure (hidden, noindex) |
| `/creator-fit` | Tool home (was `/`) |
| `/creator-fit/analyses`, `/creator-fit/analyses/[id]` | was `/analyses...` |
| `/creator-fit/r/[token]` | was `/r/[token]` |
| `/creator-fit/login`, `/creator-fit/upgrade`, `/creator-fit/detailed` | was root |
| `/privacy`, `/terms`, `/admin/*`, `/api/*`, `/auth/callback` | unchanged |

Old tool URLs 308-redirect permanently to the new ones (query strings kept), so
every shared `/r/<token>` link and bookmarked report keeps working.

## Non-goals

- No change to analysis, scoring, worker, DB schema, or API routes.
- No contact form, CMS, analytics, or video upload pipeline.

## Operator steps

- Google OAuth consent screen: set the application homepage to
  `https://overlapx.com/creator-fit` (the root no longer describes the app).
  Privacy/terms URLs are unchanged.
- Supabase redirect allowlist needs no change (`/auth/callback` stays).
