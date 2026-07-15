# Unit 31: Media Scoring (consume the 29B vision labels)

The 29B multimodal classification attaches post images to the KOL content
call and labels each (`mediaLabels`: chart_or_data | screenshot_text | meme |
promo_graphic | photo_other) — verified working on live data (40% of live
tweets carry media; 137 labels across the calibration KOLs). But no score
reads them. This unit makes media count, conservatively.

## Scope

1. **Visual promos join promo saturation** (`paidPromoRisk` v3, pure change —
   `KolContentClassification.mediaLabels` is already in scoring's input):
   a post whose image is labeled `promo_graphic` but whose `postLabel` says
   `isPromo: false` is a *visual-only promo* (shill graphic under innocent
   text — an evasion pattern) and joins the saturation numerator. Posts
   already labeled promo are not double-counted. Visual-only promos count as
   related/quality-unknown (they do not raise `unrelatedShare` — the gate
   stays evidence-driven).
2. **Deterministic media profile in the reasons**: scoring computes label
   shares (`chart_or_data + screenshot_text` = substantive, `meme`,
   `promo_graphic`) over the labeled images and appends a media-profile
   reason to `content_fit` (e.g. "Visual content across 12 labeled images:
   58% charts/data, 25% memes, 17% promo graphics."). Substantive share is
   deliberately informational-only for now — no calibration label demands a
   numeric effect, and inventing one would be uncalibrated. The knob to add
   later is documented here (a small overall bonus for substantive-dominant
   feeds).
3. **Image coverage bump**: `DEFAULT_MEDIA_IMAGE_LIMIT` 12 → 16 (live data:
   ~40% of 40 sampled posts carry media; 12 undersampled). Env override
   `OPENAI_MEDIA_IMAGE_LIMIT` unchanged. Note: changes classifyKolContent
   inputs → content cache re-classifies naturally per KOL (key includes post
   ids, not the limit — the limit affects attachments only, so existing
   cached classifications remain valid until their TTL; acceptable drift,
   noted).

## Verification

`pnpm build`; new `scripts/checks/media-scoring.regression.cjs` in
`pnpm check` (visual-only promo raises saturation; promo posts not
double-counted; profile share math + reason text; no media labels → byte-
identical scores; determinism); mock pipeline E2E; one cheap live re-score
to confirm no calibration regressions (narratives only — everything cached).

Out of scope: video content analysis (thumbnails only), FitReport schema
changes, UI changes, engagement-media (reply images).
