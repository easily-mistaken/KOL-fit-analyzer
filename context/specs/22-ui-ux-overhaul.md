# Unit 22: UI/UX Overhaul (Client-Facing Polish)

## Goal

The current UI is a flat vertical stack of near-identical cards with weak hierarchy — everything competes, scores read as a number matrix, and the verdict + audience story (the product's whole point) doesn't lead. This unit is a **complete visual/UX redesign of the entire web surface** so the reports are polished enough to put in front of **clients/brands**, and so a reader instantly grasps the important signals while still having **every** detail on the page.

Direction locked with the user:

- **Show everything — nothing hidden.** No collapse/expand of core content. Polish comes from hierarchy, spacing, typography, grouping, and data-viz — not from hiding. Important signals are visually loud and instantly graspable; the rest reads cleanly below.
- **Summary as key points, not a paragraph.** Replace the exec-summary prose with 3–5 punchy one-line takeaways.
- **ⓘ explainer on every one of the 9 metrics** — always-available plain-English "what it measures + how to read it." Additive, never a way to bury detail.
- **Client/brand-facing → supremely polished.** Treated as the product's face.
- **Whole surface** in scope: report page, reports list, submit form, status page, and the nav/shell/theme.

Scope discipline: this is a **presentation** unit. It must **not** change scoring, the pipeline, providers, the queue, or the analysis semantics. The one small data-model touch (structured summary takeaways) is called out explicitly below.

## Design System (foundation)

Reuse the tokens already in `globals.css` (ui-context.md palette: `--bg-base/surface/elevated/muted`, `--text-*`, `--accent-*`, `--state-success/warning/error/info`, `--border-*`). Additive only:

- **Type scale & rhythm:** define a small, consistent scale (display / h1 / h2 / label / body / mono-numeric) and vertical rhythm so sections feel deliberate. Mono/tabular for all scores, percentages, counts, IDs.
- **Elevation & grouping:** use surface layering (`bg-surface` → `bg-elevated` → `bg-muted`) + `border-default/strong` and `--shadow-card` to separate zones instead of identical flat cards. Radii per ui-context (`rounded-xl` panels, `rounded-2xl` large report containers).
- **Score color semantics (consistent everywhere):** success (good/high fit), warning (medium), error (weak/avoid/high-risk), muted/info (neutral/metadata). Risk metrics invert (high = error). **Never color-only** — always pair with a label/number.
- **New primitives (add only what's needed):**
  - `InfoHint` — a small accessible ⓘ button that opens a popover with the metric explainer. Built **custom** with React state (click-to-open, click-outside + Esc to close, focusable, `aria-describedby`) — **no new npm dependency**, works on touch (click) not just hover. Lives in `components/ui/info-hint.tsx`.
  - Optional lightweight `Skeleton`/shimmer utility (CSS only) for status/loading polish.
  - Data-viz is **pure inline SVG + CSS divs** (donut, bars, gauge). **No chart library, no new deps** (CSP-safe, consistent with the project's no-heavy-deps stance).
- **Do not** rewrite existing generated `components/ui/*` primitives beyond normal additions.

## Report Page — the centerpiece (`fit-report-view.tsx` + subcomponents)

Rebuilt top-to-bottom as an **analyst brief** a client can read. Everything visible; strong hierarchy. Sections in order:

1. **Hero / verdict band.** The loudest zone. `@org vs @kol`, a big **verdict** as a colored headline (STRONG/GOOD/OKAY/WEAK/AVOID with tone), a **one-line plain-English takeaway**, an **overall-score gauge** (0–100 radial/arc, colored by band) with the numeric value, a **confidence** chip, generated timestamp, and a compact **sample-size strip** (e.g. "100 posts · 1,500 engaged · 300 classified"). A reader understands the call in ~10 seconds.
2. **Key takeaways.** The summary rendered as **3–5 scannable bullet points** (see data-model note) — the "so what," each a one-liner. Replaces the paragraph.
3. **Why — drivers.** Two clear columns: **What works** (top positive drivers) and **What to watch** (negatives/risks), sourced from `overallScore.reasons` + `bestUseCases`/`weakUseCases`. Icon + short line each; visually distinct (success vs warning/error accents).
4. **Audience match (the core value — give it the most visual weight after the hero).** A proper **audience visualization**: a donut or 100%-stacked bar of the 15 buckets sorted by share, **low-quality buckets** (`bots_spam`, `giveaway_hunters`, `airdrop_farmers`) clearly flagged (error tone + a "low-quality" tag), the top buckets called out with %s, alongside the **Engaged audience match** and **Audience quality** scores and the classified sample size. This section should make "who actually listens" obvious at a glance.
5. **Score breakdown — all 9, grouped, each with an ⓘ.** Two groups: **Fit metrics** (overall, engaged audience match, audience quality, content fit, campaign goal fit, brand safety, geo/language fit) and **Risk metrics** (paid promo risk, bot/farm risk — labeled "higher is worse"). Each row: label + **ⓘ InfoHint**, a horizontal bar (colored by value / inverted for risk), the numeric value, the metric **weight** (for fit metrics), and its confidence. Everything on-screen — no hiding.
6. **Recommendation / campaign angle.** An action-oriented callout (accent-framed) with `recommendedAngle`, plus best-use-case chips — "here's how to actually use this KOL."
7. **Content & engagement.** `contentAnalysis` (themes/verticals/promo patterns as chips + narrative) and `engagementQuality` (narrative + signals).
8. **Risk & safety.** Paid-promo, bot/farm, and brand-safety narratives with their risk/score meters, grouped and clearly toned.
9. **Evidence & confidence footer.** Sample sizes (all of them), evidence notes, model/prompt version, confidence level and what drives it — the "show your work" close.

Graceful degradation stays: any missing optional section is simply omitted (the `FitReportSchema` fields are optional). The malformed-report fallback (`CompletedBody`) gets the same polish pass.

### The 9 metric explainers (authored copy — user to edit freely)

Stored as a presentational map `apps/web/lib/metric-info.ts` (`Record<ScoreMetric, { what: string; read: string }>`), surfaced by each `InfoHint`. Draft copy:

- **Overall fit** — *What:* A single 0–100 blend of all nine signals into one score and verdict, weighting engaged-audience match the most. *How to read:* The headline call. 80+ strong, 65+ good, 50+ okay, 35+ weak, below that avoid.
- **Engaged audience match (35%)** — *What:* How much of the KOL's *actually engaged* audience — people who reply, quote, and retweet, not just followers — overlaps with your target users. *How to read:* The most important metric. Higher means your real target is in the room, not just big follower counts.
- **Audience quality (20%)** — *What:* How real and valuable the engaged audience is — genuine crypto-natives vs. bots, spam, and airdrop/giveaway farmers. *How to read:* Higher = a cleaner, more valuable audience. Low scores mean the engagement is padded.
- **Content fit (15%)** — *What:* How closely the KOL's topics and themes align with what your org actually does. *How to read:* Higher = they already talk about your space, so the message lands naturally.
- **Campaign goal fit (15%)** — *What:* How suited this KOL is to your stated goal (awareness, community growth, user acquisition, dev adoption, etc.). *How to read:* Higher = a better tool for *this* campaign, even if the general fit differs.
- **Brand safety (10%)** — *What:* How safe it is to associate your brand with this KOL — controversy, misleading claims, and sketchy promotions. *How to read:* Higher = safer. Low scores are a reputational flag worth a manual look.
- **Geo / language fit (5%)** — *What:* How well the audience's region and language match your target market. *How to read:* Higher = you're reaching the right geography, not just the right topic.
- **Paid promo risk** *(risk — higher is worse)* — *What:* How much the KOL looks like a frequent paid shill, which dilutes trust and can inflate engagement. *How to read:* Higher = more promo-heavy; discount their endorsement weight accordingly.
- **Bot / farm risk** *(risk — higher is worse)* — *What:* The share of engagement that looks automated or farmed rather than real people. *How to read:* Higher = the visible engagement may not be real humans; treat reach numbers with caution.

## Reports List (`analyses-list.tsx`, `/analyses`)

Polished, client-grade list: clearer row rhythm, org/KOL shown with initial "avatars," a prominent **verdict + score** treatment (colored), status pill, relative + absolute date, hover affordance, and a stronger **empty state**. Keep it a responsive table/rows (scannable), cursor "Load more" preserved. Optional: a compact header summary (counts by verdict) — nice-to-have, not required.

## Submit Form (`analysis-form.tsx`, `/`)

Make it inviting and confident (first thing a client sees). Cleaner two-field primary (org + KOL) with better affordances/validation, and present the **optional context** as a clearly-grouped secondary panel rather than an intimidating wall — a light "add context to improve accuracy" treatment. (Optional *inputs* may still be visually secondary; this is about reducing form friction, not hiding results.) A short value-prop line stays: "we check who actually listens, not just what they post."

## Status Page (`analysis-status.tsx`)

Polish the QUEUED / RUNNING / COMPLETED / FAILED states: a clean staged progress affordance (no fake %), skeleton/shimmer while loading, and the already-improved failed panel restyled to match. Keep the existing polling logic untouched.

## Shell / Nav (`app-shell.tsx`, `top-nav.tsx`)

Refined top nav with active-route state, consistent max-width, subtle border/blur, and a small footer if it helps the "product" feel. Keep the single internal-workspace assumption.

## Data-Model Note (the one non-presentational change)

Rendering the summary as points is cleaner with structured data than by splitting a paragraph. Add an **optional** `keyTakeaways: string[]` to `FitReportSchema` (alongside the existing `summary`), generated by both providers (OpenAI: add to `REPORT_NARRATIVE_SCHEMA` + prompt as "3–5 one-line takeaways"; mock: deterministic list). Optional + additive → old reports still validate, `REPORT_SCHEMA_VERSION` unchanged, no migration (report is JSON). The UI renders `keyTakeaways` as the bullets and falls back to `summary` if absent. (Alternatively keep only `summary` and render sentence-split bullets — but the structured field is the polished, reliable option and is recommended.)

## Component / File Plan

- New: `components/ui/info-hint.tsx`, `lib/metric-info.ts`; likely new report subcomponents (`report-hero.tsx`, `key-takeaways.tsx`, `drivers.tsx`, `audience-panel.tsx` (donut), `score-group.tsx`, `recommendation.tsx`, `risk-panel.tsx`, `evidence-footer.tsx`) replacing/absorbing today's `score-matrix`/`score-meter`/`audience-bars`/`report-section`.
- Rewrite: `fit-report-view.tsx`, `analyses-list.tsx`, `analysis-form.tsx`, `analysis-status.tsx`, `app-shell.tsx`, `top-nav.tsx`, home `page.tsx`.
- Reuse: `verdict-badge.tsx` (extend), the DTOs/routes (no shape change except the optional `keyTakeaways` flowing through the saved report JSON — already carried as `fitReport`).
- Providers/shared: only the additive `keyTakeaways` (shared schema + openai schema/prompt/normalize + mock).

## Dependencies

- **No new npm packages** (custom `InfoHint`, SVG/CSS data-viz). No live-network/provider work.

## Verification

- `pnpm build` (all projects incl. `apps/web`) + `pnpm check` green.
- A mock run renders the redesigned report with: verdict hero + gauge, key-takeaway bullets, drivers, audience donut (low-quality flagged), all 9 scores each with a working ⓘ popover, recommendation, content/engagement, risk, evidence footer.
- Reports list, submit form, status states, and shell all visibly restyled and consistent.
- Responsive: desktop two-column where useful, clean single-column mobile; tables/donut degrade gracefully; ⓘ works on touch + keyboard (Esc/click-away close).
- Scope guard: no scoring/pipeline/provider/queue/API-shape change; only the additive `keyTakeaways`; no `ui/*` primitive rewritten beyond additions; docs (`ui-context.md` if conventions change, `progress-tracker.md`) updated.

## Open Questions / Decisions (recommended defaults in place)

- **Audience viz:** donut vs 100%-stacked bar for the 15 buckets. Recommend **donut + ranked legend** (clear share-of-audience read), stacked bar as fallback on narrow screens.
- **Summary source:** add `keyTakeaways: string[]` (recommended) vs sentence-split the existing paragraph.
- **Review vehicle:** since the reader isn't a UI person, recommend I first produce a **live visual mockup (Artifact) of the redesigned report with real sample data** to react to, before rebuilding the real components — faster/cheaper to iterate on look-and-feel than editing code blind.
