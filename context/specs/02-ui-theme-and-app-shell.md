# Unit 02: UI Theme and App Shell

## Goal

Give `apps/web` the dark, analyst-dashboard visual system defined in `context/ui-context.md`, plus a basic app shell (top navigation + centered main content) and a static placeholder landing page. At the end of this unit, the app looks and feels like the intended product — nothing is wired to real data yet.

Explicit non-goals for this unit (covered by later units, do not implement here):

- No analysis form (Unit 08). This unit's landing page is static/placeholder only.
- No API routes (Unit 05+).
- No database/Prisma (Unit 03).
- No worker changes (already scaffolded in Unit 01; untouched here).
- No TwitterAPI.io or LLM logic (Units 10-11, 16-17).
- No scoring logic (Unit 14).
- No report page, status page, or reports list (Units 09, 15, 20) — this unit only previews their *empty states* as static content, per `ui-context.md`.

## Design Requirements

All from `context/ui-context.md` — this unit's job is to make these real:

- **Theme**: dark technical workspace only. No light theme, no theme toggle — `ui-context.md` defines a single dark visual language and nothing else is in scope.
- **Color tokens**: implement every CSS variable from the `ui-context.md` Colors table (`--bg-base`, `--bg-surface`, `--bg-elevated`, `--bg-muted`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-primary`, `--accent-hover`, `--state-success`, `--state-warning`, `--state-error`, `--state-info`, `--border-default`, `--border-strong`, `--shadow-card`) with their specified hex/rgba values. Components must consume these via Tailwind theme mapping or `var(--token)` — never hardcode hex values in component code (`code-standards.md` — Styling).
- **Typography**: `--font-sans` = Geist Sans (or Inter), `--font-mono` = Geist Mono (or JetBrains Mono), loaded via `next/font`-compatible means. Numbers/IDs use the mono variable where relevant.
- **Border radius scale**: small controls `rounded-md`, inputs/buttons `rounded-lg`, cards/panels `rounded-xl`, large containers/modals `rounded-2xl` — Tailwind's default scale already provides these class names; this unit just needs consistent usage, not new tokens.
- **Component library**: shadcn/ui on Tailwind. Only add the primitives this unit actually uses (`Button`, `Card`, `Badge`, `Separator`) — do not scaffold the full suite from `ui-context.md`'s Expected Components list before later units need them (`ai-workflow-rules.md` — do not add dependencies before the unit needs them).
- **Icons**: Lucide React only, stroke-based, `h-4 w-4` inline/metadata, `h-5 w-5` buttons/headings.
- **App Shell layout** (`ui-context.md` — Layout Patterns → App Shell): full-width dark dashboard; top navigation with product name and primary actions; main content centered with a generous max width; cards/panels for content blocks.
- **No flashy crypto gradients** beyond small, intentional accents. Minimal decorative elements. This should look like a serious research tool, not a marketing page or generic AI chat product.

## Landing Page Content (placeholder/static only)

Per your scope note, this unit adds no real analysis form. The landing page should:

1. Show the product name (sourced from `@kol-fit/shared`'s `APP_NAME` constant, continuing the Unit 01 workspace-import wiring — do not replace it with a hardcoded string) and the product positioning line from `context/project-overview.md`: *"We don't just check what a KOL posts. We check who actually listens."*
2. Preview the future dashboard using the exact **Empty State** copy already defined in `ui-context.md`: "No reports yet" / "Create your first KOL fit analysis" — rendered inside a `Card`, styled, but with **no functional button, link, or route** behind it. This previews Unit 20's reports list without inventing new copy or wiring anything real.
3. No form fields, no submit actions, no fetch calls, no disabled-but-implies-functionality controls that could read as broken.

## Implementation Steps

1. **Install Tailwind CSS** in `apps/web` (not yet present per Unit 01). Use whatever the current stable major version's official Next.js App Router setup is at implementation time (v3's `tailwind.config.ts` + `postcss.config.js`, or v4's CSS-first `@import "tailwindcss"` + `@theme` — check what `pnpm add -D tailwindcss` actually resolves to, the same way Unit 01 had to adapt to the TypeScript version it resolved). Wire the stylesheet into `apps/web/app/layout.tsx` (a `globals.css` import).

2. **Define the color tokens** from `ui-context.md` as CSS custom properties in the global stylesheet's `:root` (dark-only, not gated behind `prefers-color-scheme` — there is no light variant). Map Tailwind theme colors (`theme.extend.colors` for v3, or `@theme` for v4) to these variables so utility classes like `bg-surface`, `text-primary`, `border-default`, `text-success` etc. are available and resolve to the tokens — not raw hex.

3. **Load fonts** via `next/font` (e.g. the `geist` package for Geist Sans + Geist Mono, or `next/font/google` for Inter/JetBrains Mono if preferred) and expose them as the `--font-sans` / `--font-mono` CSS variables on the `<html>` or `<body>` element.

4. **Initialize shadcn/ui** in `apps/web` (CLI init), configuring its base color/style generation to point at the `ui-context.md` tokens above rather than shadcn's own default palette. Confirm generated primitives land in `apps/web/components/ui/` and the CLI's `cn()` helper lands in `apps/web/lib/utils.ts`, per `code-standards.md` File Organization.

5. **Add only the needed shadcn primitives**: `Button`, `Card`, `Badge`, `Separator`. Do not add `Input`, `Textarea`, `Select`, `Tabs`, `Table`, `Progress`, `Skeleton`, `Dialog`, `Tooltip`, `Alert` yet — those arrive with the units that actually render them (Unit 08 form, Unit 09 status page, Unit 15 report renderer).

6. **Install `lucide-react`.** Use one or two icons from `ui-context.md`'s suggested list (e.g. `FileText` or `Search`) on the landing page only where they add clarity, per the `h-4 w-4` / `h-5 w-5` sizing rule.

7. **Build the app shell** as a reusable component, e.g. `apps/web/components/app-shell.tsx` (plus a `apps/web/components/top-nav.tsx` if it's cleaner as its own piece):
   - Top navigation bar: product name from `@kol-fit/shared`'s `APP_NAME`, static/non-interactive (no primary actions exist yet — do not invent placeholder nav links to routes that don't exist).
   - Main content area: centered, generous `max-w-*`, padded, dark surface background per `--bg-surface` / `--bg-base`.
   - Wrap this shell around `{children}` in `apps/web/app/layout.tsx`, replacing Unit 01's bare `<body>{children}</body>`.

8. **Build the landing page** at `apps/web/app/page.tsx` per "Landing Page Content" above, using `Card`, `Badge`/`Separator` as appropriate, styled with the new theme tokens and border-radius conventions.

9. **Do not touch**: `apps/worker/*`, `packages/db`, `packages/twitter`, `packages/llm`, `packages/analysis`, `packages/scoring`, any `apps/web/app/api/*` (none should be created).

## Dependencies Introduced

- `tailwindcss` (+ whatever its current major version requires: `postcss`, `autoprefixer` for v3; `@tailwindcss/postcss` for v4 — confirm against the resolved version)
- shadcn/ui CLI-generated primitives and their peer deps (typically `class-variance-authority`, `clsx`, `tailwind-merge`, and per-component Radix primitives such as `@radix-ui/react-slot`, `@radix-ui/react-separator` — exact set determined by which components are added)
- `lucide-react`
- A font package (`geist`, or rely on `next/font/google` for Inter/JetBrains Mono — no extra dependency needed in that case)

Explicitly not introduced yet: Prisma, pg-boss, Zod, OpenAI SDK, TwitterAPI.io client, any shadcn component beyond `Button`/`Card`/`Badge`/`Separator`.

## Verification Checklist

- [ ] `pnpm build` passes.
- [ ] `pnpm --filter web dev` starts and the home page renders without errors.
- [ ] The page background, surfaces, text, borders, and accent colors visually match the `ui-context.md` token values (dark, near-black base, restrained accent — not default shadcn gray/zinc theme).
- [ ] No component file contains a hardcoded hex color; all colors resolve through Tailwind theme tokens / CSS variables.
- [ ] Top navigation shows the product name (rendered via `@kol-fit/shared`'s `APP_NAME`, not a hardcoded string) and no dead/placeholder nav links.
- [ ] Main content is centered with a generous max width, matching the App Shell layout pattern.
- [ ] Landing page shows the product positioning line and the static "No reports yet" / "Create your first KOL fit analysis" empty-state card, with no functional button/link behind it.
- [ ] Only `Button`, `Card`, `Badge`, `Separator` shadcn primitives exist in `apps/web/components/ui/`.
- [ ] Lucide icons (if used) follow the `h-4 w-4` / `h-5 w-5` sizing rule and are stroke-based.
- [ ] No files were created under `apps/web/app/api/`, `packages/db`, `packages/twitter`, `packages/llm`, `packages/analysis`, or `packages/scoring`.
- [ ] `apps/worker` is untouched.
- [ ] `context/progress-tracker.md` is updated to reflect Unit 02 completion once implementation lands.
