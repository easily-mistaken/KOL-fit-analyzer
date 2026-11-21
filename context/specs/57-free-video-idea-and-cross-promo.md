# Unit 57: Free Video Idea Offer and Cross-Promotion

User request, 2026-11-21: highlight https://launchgallery.video/ more ("find inspiration"), add the "Free Video Idea" offer that launchgallery.video has, collecting the same details (video idea, budget, contact), and push visitors to Creator Fit, Launch Gallery and the free idea offer.

## Scope

1. **Form** (`components/agency/video-idea-form.tsx`), same questions as launchgallery.video: what you are launching (required, 3 to 300 chars), budget range (required), video style (optional), where to send it (email, X or Telegram; handles and profile links normalised), optional product link and reference video. Honeypot field `hp_note`. Options and the zod schema live in `packages/shared/src/video-idea.ts`; stored values are the option keys, never rename one.
2. **API** `POST /api/video-ideas`: validates, stores a `VideoIdeaRequest` row, pings the operator on Telegram (`buildVideoIdeaNotification`). Limits: 3 per browser (owner cookie) per day, 40 site-wide per hour.
3. **Admin** `/admin/video-ideas` (newest first, opening it marks all seen) with a nav badge from `GET /api/admin/video-ideas`. Fulfilment is manual: reply on the channel the visitor picked.
4. **Placement:** `/free-video-idea` page (form, Launch Gallery and Creator Fit cards, featured work). Home gets the form section after Process, above the Launch Gallery strip and the Creator Fit promo. `FreeResources` cards (free idea, Launch Gallery, Creator Fit) on service pages and guides; subsets on /work, /guides and /about. Hero and final CTA: "Not ready for a call? Get a free video idea". Header (lg and up, and the mobile menu) and footer link to it. Launch Gallery strip now reads "Need inspiration? / Find inspiration".
5. **Data:** additive Prisma model `VideoIdeaRequest`; production needs `prisma db push` (verified with `migrate diff`: one CREATE TABLE and three indexes, nothing else).

## Rules

The budget picker shows the visitor's budget ranges (owner's request, mirroring Launch Gallery); it is not a price for OverlapX's work, which stays unpublished. No em or en dashes. Launch Gallery links stay followed with `rel="noopener"` only.
