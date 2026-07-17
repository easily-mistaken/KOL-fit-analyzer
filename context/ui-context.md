# UI Context

## Theme

The product serves AI and Web3 brands alike, so nothing in the surface should read as crypto-specific. The visual language takes after **Robinhood and Higgsfield**: near-black surfaces, a single acid-lime brand accent, pill-shaped controls, tight geometric headlines, and flat surfaces. Confident and instrument-like rather than decorative.

Use a dark technical workspace:

- near-black page background with a cool cast (not warm charcoal, not blue-black)
- flat layered surfaces; no glassmorphism, no decorative gradients
- subtle borders, generous padding, pill controls (`rounded-full`)
- high-contrast text (pure white headlines)
- a single acid-lime brand accent
- semantic score colors (green/amber/red) kept **separate** from the lime accent
- minimal decorative elements

**The lime is a LIGHT accent.** Anything sitting on it (button labels, badge text) must use `--accent-contrast` (near-black), never `--text-primary`. This is the most common way to break the theme.

Avoid the generic-AI-app tells: no `Sparkles` icons, no glyph-in-a-gradient-rounded-square logo, no electric-blue-on-charcoal, no glass blur panels.

The UI should make the report easy to scan. Prioritize clarity, hierarchy, and evidence over visual noise.

## Colors

All components should use semantic tokens. Avoid hardcoded random hex values inside components.

Suggested CSS variables:

Palette (implemented in `apps/web/app/globals.css`):

| Role | CSS Variable | Value |
| --- | --- | --- |
| Page background | `--bg-base` | `#0A0C10` |
| Main surface | `--bg-surface` | `#111419` |
| Raised surface | `--bg-elevated` | `#191D24` |
| Muted surface | `--bg-muted` | `#232830` |
| Primary text | `--text-primary` | `#FFFFFF` |
| Secondary text | `--text-secondary` | `#9BA3AF` |
| Muted text | `--text-muted` | `#6B7480` |
| Brand accent (acid lime) | `--accent-primary` | `#BEF54B` |
| Accent hover | `--accent-hover` | `#D0F87A` |
| **Text/icons on the lime** | `--accent-contrast` | `#0A0C10` |
| Positive | `--state-success` | `#4ADE80` |
| Warning | `--state-warning` | `#FBBF4C` |
| Error | `--state-error` | `#FF5C5C` |
| Info | `--state-info` | `#60A5FA` |
| Border default | `--border-default` | `#1E232A` |
| Border strong | `--border-strong` | `#2E353F` |
| Card shadow | `--shadow-card` | `0 1px 2px rgba(0,0,0,.4), 0 16px 40px rgba(0,0,0,.32)` (→ `shadow-card` utility) |

Token wiring worth knowing: `--accent` is the **brand lime** here, not shadcn's neutral hover surface. shadcn primitives that want a quiet hover say `bg-elevated` explicitly. `--primary-foreground` and `--accent-foreground` both resolve to `--accent-contrast`, which is what keeps lime buttons readable.

The brand mark is `apps/web/public/logo.svg` (tab icon: `apps/web/app/icon.svg`). Swap those files to rebrand; no component change needed.

The hero canvas (`audience-field.tsx`) can't read CSS tokens, so it mirrors the lime in JS constants. Keep them in sync.

### Chart color

The audience donut carries its own **categorical identity palette**, deliberately separate from the brand lime so a slice never reads as a control, and from the status tones. Colour follows the bucket, never its rank. The hues are validated (dark band, chroma floor, adjacent-pair CVD, normal-vision floor, 3:1 on surface) — see the header comment in `audience-donut.tsx` for the re-validation command. Low-quality buckets always render in the reserved error tone.

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
