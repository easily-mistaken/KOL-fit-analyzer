# UI Context

## Theme

The product serves AI and Web3 brands alike, so nothing in the surface should read as crypto-specific. The visual language takes after **Robinhood and Higgsfield**: a single acid-lime brand accent, pill-shaped controls, tight geometric headlines, and flat surfaces. Confident and instrument-like rather than decorative.

**Light is the default and dark is opt-in** ("white first"). Both themes are first-class:

- light: off-white paper (`#F7F7F5`), white cards, near-black type
- dark: near-black with a cool cast (`#0A0C10`), not warm charcoal
- flat layered surfaces; no glassmorphism, no decorative gradients
- subtle borders, generous padding, pill controls (`rounded-full`)
- a single acid-lime brand accent, in both themes
- semantic score colors kept **separate** from the lime accent
- minimal decorative elements

### Theming rules

Dark is applied as `data-theme="dark"` on `<html>` by `ThemeToggle`, persisted to `localStorage`, and replayed before first paint by the inline script in `layout.tsx` (`lib/theme.ts`). OS `prefers-color-scheme` is deliberately **not** auto-applied — the product opens light unless the reader chose otherwise.

Only the raw values in the two blocks at the top of `globals.css` change between themes. Every mapping below them is written once. To retheme, edit those blocks and nothing else.

**The lime is a LIGHT colour**, which drives the whole accent split:

| Token | Job |
| --- | --- |
| `--accent-primary` | the lime fill itself (identical in both themes) |
| `--accent-contrast` | what sits ON the lime (near-black, both themes) |
| `--accent-ink` | the accent as **text/icons** on the page background (`text-accent-ink`) |
| `--accent-hover` | hover state for lime **fills** (`bg-accent-hover`) |

Lime text on white is illegible, so `--accent-ink` darkens in light mode. **Never use `--accent-primary` as a text colour**, and never put `--text-primary` on a lime fill. Those are the two ways to break this theme.

Avoid the generic-AI-app tells: no `Sparkles` icons, no glyph-in-a-gradient-rounded-square logo, no electric-blue-on-charcoal, no glass blur panels.

The UI should make the report easy to scan. Prioritize clarity, hierarchy, and evidence over visual noise.

## Colors

All components should use semantic tokens. Avoid hardcoded random hex values inside components.

Suggested CSS variables:

Palette (implemented in `apps/web/app/globals.css`). Both modes are **selected**, not flipped:

| Role | CSS Variable | Light (default) | Dark |
| --- | --- | --- | --- |
| Page background | `--bg-base` | `#F7F7F5` | `#0A0C10` |
| Main surface | `--bg-surface` | `#FFFFFF` | `#111419` |
| Raised surface | `--bg-elevated` | `#F0F0ED` | `#191D24` |
| Muted surface | `--bg-muted` | `#E7E7E3` | `#232830` |
| Primary text | `--text-primary` | `#0A0C10` | `#FFFFFF` |
| Secondary text | `--text-secondary` | `#55595F` | `#9BA3AF` |
| Muted text | `--text-muted` | `#83878D` | `#6B7480` |
| Brand lime (fill) | `--accent-primary` | `#BEF54B` | `#BEF54B` |
| On the lime | `--accent-contrast` | `#0A0C10` | `#0A0C10` |
| Accent as text | `--accent-ink` | `#5B830A` | `#D0F87A` |
| Lime fill hover | `--accent-hover` | `#AEE93A` | `#D0F87A` |
| Positive | `--state-success` | `#1F9D57` | `#4ADE80` |
| Warning | `--state-warning` | `#B67611` | `#FBBF4C` |
| Error | `--state-error` | `#D6433B` | `#FF5C5C` |
| Info | `--state-info` | `#2563EB` | `#60A5FA` |
| Border default | `--border-default` | `#E5E5E1` | `#1E232A` |
| Border strong | `--border-strong` | `#CFCFCA` | `#2E353F` |

Token wiring worth knowing: `--accent` is the **brand lime** here, not shadcn's neutral hover surface. shadcn primitives that want a quiet hover say `bg-elevated` explicitly. `--primary-foreground` and `--accent-foreground` both resolve to `--accent-contrast`, which is what keeps lime buttons readable.

The brand mark is `apps/web/public/logo.svg` (tab icon: `apps/web/app/icon.svg`). Swap those files to rebrand; no component change needed.

The audience-field canvas (`audience-field.tsx`) can't read CSS tokens directly, so it reads the `--field-*` tokens off the document and re-reads them on `data-theme` changes. Lime is invisible on white, so light mode steps the engaged colour down to a deeper green (`--field-engaged`) rather than reusing the brand fill. It runs **only behind the in-progress panel** (`analysis-status.tsx`) — the landing hero is a plain surface; see the progress tracker for why.

### Chart color

The audience charts carry their own **categorical identity palette** (the `--viz-*` tokens), deliberately separate from the brand lime so a slice never reads as a control, and from the status tones. Colour follows the VALUE, never its rank. Light and dark are each stepped for their own surface and validated separately (lightness band, chroma floor, adjacent-pair CVD, normal-vision floor, contrast) — see the header comment in `audience-donut.tsx` for the re-validation commands.

The audience renders as **two donuts over the same accounts** (Unit 43) — one by DOMAIN ("what they're into"), one by ROLE ("what they do") — plus an ordered QUALITY strip. Two rings rather than one because the taxonomy has two orthogonal categorical axes; collapsing them back into a single ring is what produced the `non_crypto` dead end in the first place. The caption says explicitly that both rings cover the same people read two ways, or a reader tries to reconcile "40% developers" with "30% AI" and concludes one is wrong.

Quality is deliberately NOT a third ring: it is one ordered good→bad reading, not a set of peer categories, so it gets a stacked strip ending in the reserved error tone. That also keeps the two categorical rings free of a status colour.

The split made the palette problem EASIER. Role and domain are separate charts, so their colours never compete inside one ring and each map may reuse the same eleven validated hues independently. Exactly one pair must double up (14 domains vs 11 categorical hues + 2 neutrals): `news_politics` shares `culture`'s hue, chosen because both are general-interest domains, so a collision reads as one family rather than a mislabel. Identity never rests on colour alone — every slice carries a swatch, a label, and a percentage.

Neither ring draws more than `AUDIENCE_MAX_SEGMENTS` (6) slices. Each axis is folded by `foldSegments` in `@kol-fit/shared` (pure, axis-agnostic, unit-tested in `audience-segments.regression.cjs`): values are ranked by share, the top ones keep their own slice, and the tail folds into a neutral "Other" that always sorts last. Nothing is lost — a folded slice breaks itself down (each member with its own share) in the tooltip and the `title`. This keeps each live palette at ≤ 6 hues, inside what the validated set separates.

Score color usage:

- Strong/positive fit: success token
- Okay/medium fit: warning token
- Weak/avoid/risk: error token
- Neutral metadata: muted/info tokens

Do not use color alone to communicate meaning. Use labels and text.

## Typography

| Role | Font | Variable |
| --- | --- | --- |
| UI text | Geist Sans or Inter | `--font-sans` |
| Code/mono/numbers | Geist Mono or JetBrains Mono | `--font-mono` |

Typography rules:

- Use clear section headings.
- Use tabular/mono styling for score numbers, sample sizes, and IDs where useful.
- Keep report paragraphs readable and short.
- Avoid overly large marketing headings inside the report view.

## Border Radius

| Context | Class |
| --- | --- |
| Small controls | `rounded-md` |
| Inputs/buttons | `rounded-lg` |
| Cards/panels | `rounded-xl` |
| Large report containers | `rounded-2xl` |
| Modals/overlays | `rounded-2xl` |

## Component Library

Use shadcn/ui on top of Tailwind CSS.

Expected components:

- Button
- Input
- Textarea
- Select
- Badge
- Card
- Tabs
- Table
- Progress
- Separator
- Skeleton
- Dialog
- Tooltip
- Alert

Rules:

- Components in `components/ui/` are generated primitives. Do not heavily rewrite them without explicit instruction.
- Build app-specific components in `components/` or feature folders.
- Keep report sections reusable.

## Layout Patterns

### App Shell

- Full-width dark dashboard.
- Top navigation with product name and primary actions.
- Main content centered with generous max width.
- Use cards/panels for form and report sections.

### Analysis Form

- Primary inputs at top:
  - organization handle
  - KOL handle
- Optional context in expandable or secondary section:
  - website URL
  - docs URL
  - product category
  - target user
  - campaign goal
  - stage
  - region/language
- Submit button clearly indicates analysis creation.

### Report Page

The report page should have:

1. Header with org, KOL, status, and generated timestamp.
2. Overall score card.
3. Verdict summary.
4. Score breakdown grid.
5. Audience match section.
6. Audience breakdown table/chart.
7. Content analysis section.
8. Engagement quality section.
9. Risk sections.
10. Evidence/sample-size footer.

### Status States

Report generation should support:

- queued
- running
- completed
- failed

Use clear loading states and status text. Do not fake progress percentages unless real stage progress exists.

### Empty States

Empty states should be simple and direct:

- No reports yet
- Create your first fit analysis
- Analysis failed with reason
- Data unavailable from provider

### Responsive Behavior

- Desktop: two-column layouts for scorecards and details where useful.
- Mobile: single-column stacked cards.
- Tables should become scrollable or simplified on small screens.

## Icons

Use Lucide React.

Icon rules:

- `h-4 w-4` for inline labels and metadata.
- `h-5 w-5` for buttons and section headings.
- Stroke-based icons only.
- Do not mix icon libraries.

Suggested icons:

- Search/check: analysis request
- BarChart/Activity: scoring
- Users: audience
- ShieldAlert: risk
- Megaphone: paid promotion
- Globe: geo/language
- Clock: job status
- FileText: report

## Report Design Principles

- The user should understand the verdict within 10 seconds.
- The user should be able to inspect evidence after the verdict.
- Scores must be visually clear but not hide the reasoning.
- Do not make the UI look like a generic AI chat product.
- The report should feel like an analyst brief.
