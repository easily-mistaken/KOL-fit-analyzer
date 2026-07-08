# UI Context

## Theme

The product should feel like a serious crypto intelligence dashboard, not a playful social media tool. The visual language is dark, sharp, analytical, and information-dense. It should look suitable for an internal agency research tool and later a SaaS dashboard for crypto growth teams.

Use a dark technical workspace:

- near-black page background
- layered dark surfaces
- subtle borders
- high-contrast text
- restrained accent color
- score cards and report sections
- minimal decorative elements
- no flashy crypto gradients unless intentionally used in small accents

The UI should make the report easy to scan. Prioritize clarity, hierarchy, and evidence over visual noise.

## Colors

All components should use semantic tokens. Avoid hardcoded random hex values inside components.

Suggested CSS variables:

| Role | CSS Variable | Value |
| --- | --- | --- |
| Page background | `--bg-base` | `#080A0F` |
| Main surface | `--bg-surface` | `#10131A` |
| Raised surface | `--bg-elevated` | `#171B24` |
| Muted surface | `--bg-muted` | `#1D2230` |
| Primary text | `--text-primary` | `#F4F7FB` |
| Secondary text | `--text-secondary` | `#B8C0CC` |
| Muted text | `--text-muted` | `#7D8794` |
| Primary accent | `--accent-primary` | `#6D5EF7` |
| Accent hover | `--accent-hover` | `#8175FF` |
| Positive | `--state-success` | `#35D07F` |
| Warning | `--state-warning` | `#F5B84B` |
| Error | `--state-error` | `#FF5C6C` |
| Info | `--state-info` | `#4DA3FF` |
| Border default | `--border-default` | `#252B38` |
| Border strong | `--border-strong` | `#353D4D` |
| Card shadow | `--shadow-card` | `rgba(0, 0, 0, 0.35)` |

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
- Create your first KOL fit analysis
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
