# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 1: Project Foundation — Units 01–03 complete

## Current Goal

- Implement Unit 04 (API Response and Shared Zod Schemas) next.

## Completed

- Product direction clarified: known KOL fit analysis for crypto startups/orgs.
- Core value clarified: engaged audience match is more important than content similarity.
- First data provider selected: TwitterAPI.io through provider abstraction.
- First LLM provider selected: OpenAI through provider abstraction.
- Architecture direction selected: serious but lean TypeScript system with web app + worker.
- Queue decision selected: pg-boss on Postgres first, Redis/BullMQ later only if needed.
- Database decision selected: Supabase Postgres.
- ORM decision selected: Prisma for AI-coding friendliness.
- Initial context files created.
- Unit 01: Repository Scaffold and Tooling. pnpm workspace (`apps/web`, `apps/worker`, `packages/{shared,db,twitter,llm,analysis,scoring}`) scaffolded; git initialized with `.gitignore` (no commits made); root `tsconfig.base.json` added (TypeScript strict mode; `module`/`moduleResolution` set to `Node16` after `Node10` proved deprecated in the resolved TypeScript 6.0.3); `.env.example` added with `DATABASE_URL`, `DIRECT_URL`, `TWITTERAPI_IO_KEY`, `OPENAI_API_KEY`, `LLM_MODEL`, `NEXT_PUBLIC_APP_URL`. `pnpm install` and `pnpm build` both pass across all 8 packages/apps. `apps/web` dev server verified to render the `@kol-fit/shared` `APP_NAME` constant; `apps/worker` verified (both built output and `tsx`) to log a "worker booted" message including it. No Tailwind/shadcn, Prisma, pg-boss, Zod, or provider logic added, per scope. See `context/specs/01-project-scaffold.md`.
- Unit 02 spec created at `context/specs/02-ui-theme-and-app-shell.md`.
- Unit 02: UI Theme and App Shell — implemented and verified. `apps/web` now has the dark analyst-dashboard visual system from `ui-context.md`, a reusable app shell (top nav + centered content), and a static placeholder landing page. Details: Tailwind v4 (CSS-first; `tailwindcss` + `@tailwindcss/postcss` resolved to 4.3.2, so v4's `@import "tailwindcss"` + `@theme inline` was used, not v3 config files) wired via `apps/web/postcss.config.mjs` and `apps/web/app/globals.css`. All 16 `ui-context.md` colors defined as raw `:root` CSS variables with their exact hex/rgba values; mapped through `@theme inline` to both shadcn semantic tokens (so generated primitives render on the palette, untouched) and ui-context-named utilities (`bg-surface`, `bg-elevated`, `text-success`, `border-default`, `border-strong`, etc.). No component hardcodes a hex (verified by grep). Dark-only, no toggle (tokens live directly in `:root`, `color-scheme: dark`). Fonts via `next/font/google` Inter (`--font-sans`) + JetBrains Mono (`--font-mono`) — no extra font package. shadcn/ui set up with `components.json` + `cn()` in `apps/web/lib/utils.ts` + only the four in-scope primitives in `apps/web/components/ui/` (`button`, `card`, `badge`, `separator`); peer deps `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `@radix-ui/react-slot`, `@radix-ui/react-separator`, plus `lucide-react` for icons. App shell in `apps/web/components/{app-shell,top-nav}.tsx` (product name from `@kol-fit/shared` `APP_NAME`, no dead nav links). Static landing page at `apps/web/app/page.tsx`: product name + positioning line + a non-interactive "No reports yet" / "Create your first KOL fit analysis" empty-state card (rendered HTML contains zero `<button>`/`<a>` elements). `apps/web/tsconfig.json` gained `@/*` path alias. `pnpm build` passes across all 8 packages/apps; dev server renders `/` with 200 and the compiled CSS contains all 15 token hex values. No API routes, DB/Prisma, worker changes, or provider/scoring logic added. See `context/specs/02-ui-theme-and-app-shell.md`.

- Unit 03: Prisma Database Schema — implemented and verified. Prisma set up **only** in `packages/db`. `prisma/schema.prisma` defines the initial Postgres schema: models `Workspace`, `AnalysisRequest`, `AnalysisJob`, `OrgProfile`, `KolProfile`, `Report`, `ReportEvidence`, `EngagedAccountSample`, `ProviderUsageLog`; enums `JobStatus`, `ReportStatus`, `ReportVerdict`, `EngagementSource`. Workspace-ready (nullable `workspaceId` on `AnalysisRequest` + `Report`), reports persisted from day one, deterministic `Report.scores` kept separate from LLM `Report.report`, compact evidence in `ReportEvidence`, no raw-payload columns, indexes for workspace/history + job status + org/KOL handle + `createdAt`. Client singleton in `packages/db/src/client.ts`, package barrel in `packages/db/src/index.ts` re-exporting `prisma` + all generated types/enums under `@kol-fit/db`. Verified offline: `prisma validate` passes, `prisma format` is idempotent, `prisma generate` succeeds, a runtime export smoke test loads the client (with adapter) and reads all four enums, and `pnpm build` passes across all 8 packages/apps. Resolved to **Prisma 7.8.0**, which required adapting away from the spec's v6-shaped assumptions (see Architecture Decisions + the Implementation Note in the spec). No queue/pg-boss, worker, analysis, provider, LLM, scoring, or API/UI logic added. See `context/specs/03-prisma-database-schema.md`.

## In Progress

- None. Unit 03 complete and verified.

## Next Up

- Unit 04: API Response and Shared Zod Schemas. See `context/specs/00-build-plan.md` (no spec file written yet).

## Open Questions

- **Architecture doc naming reconciliation (still open, non-blocking):** the Unit 03 schema uses `OrgProfile`/`KolProfile`/`Report`/`EngagedAccountSample` and folds `ScoreBreakdown`/`AudienceClassificationSummary` into `Report` JSON columns + `ReportEvidence`, whereas `architecture.md` → *Suggested Database Models* still lists the older `OrgSnapshot`/`KolSnapshot`/`AnalysisReport`/`EngagedAudienceSample` names. This is a naming refinement only (no change to system boundaries or invariants), so `architecture.md` was intentionally left untouched during Unit 03's tight scope. Align that section's names when convenient (or in a docs pass). Mapping is documented in `context/specs/03-prisma-database-schema.md` → *Reconciliation with architecture.md*.
- **Live-DB verification deferred:** no Supabase `DATABASE_URL`/`DIRECT_URL` is configured in this environment, so the online steps (`prisma migrate dev`, connection smoke test) were not run. Offline verification (`prisma validate` + `prisma generate` + runtime export smoke test + `pnpm build`) all pass. Run the online steps once credentials exist; the initial migration has not yet been generated (`packages/db/prisma/migrations/` does not exist yet).
- Prior session's open questions remain resolved (see Architecture Decisions below). None block Unit 04.

## Architecture Decisions

- Use a modular TypeScript architecture with `apps/web`, `apps/worker`, and shared `packages/*` boundaries.
- Use Next.js for UI and lightweight route handlers.
- Use worker jobs for deep analysis instead of API route execution.
- Use Supabase Postgres as the primary database.
- Use Prisma as ORM.
- Use pg-boss for background jobs to avoid Redis cost/complexity at the start.
- Use TwitterAPI.io as the first X/Twitter provider.
- Use provider abstraction for Twitter/X providers.
- Use OpenAI first for LLM analysis, behind an LLM provider abstraction.
- Save reports and evidence/sample-size metadata for future KOL intelligence.
- Package manager is pnpm with pnpm workspaces; all `npm` references in docs/scripts are replaced with `pnpm`.
- Git is initialized during Unit 01 with a standard `.gitignore`. No commits are made unless explicitly requested.
- Auth is out of scope for the first build entirely (not even a simple internal gate). Assume a single internal workspace. Reports/requests carry a nullable `workspaceId` from the first schema onward so real workspaces can be added later without a breaking migration.
- Reports are persisted in the database from the first unit that has a DB (Unit 03 schema, first real save in Unit 07's placeholder report). A saved-reports list/history UI is deferred to Unit 20.
- The LLM model is never hardcoded; it is read from the `LLM_MODEL` environment variable and chosen concretely during Unit 17 (live OpenAI provider).
- Analysis depth/cost caps are centralized config constants (see `architecture.md` — Analysis Depth and Cost Controls), adjustable later in Unit 19: 100 KOL posts, 50 KOL replies, top 20 posts for deep analysis, 50 replies/post, 30 quotes/post, 100 retweeters/post, 1,500 unique engaged accounts max per report.
- Raw provider payloads (Twitter/X and website/docs fetches) are not stored indefinitely. Only normalized entities, sample-size metadata, and compact evidence JSON are persisted.
- Website/docs URLs get lightweight single-page fetch + parse (strict size/timeout limits, no crawler), implemented as a module inside `packages/analysis` (new Unit 12), not a separate provider package.
- AGENTS.md and CLAUDE.md are kept aligned; CLAUDE.md is the active entry file for Claude Code. Reviewed AGENTS.md for conflicts — none found beyond a stale `npm run build` reference, now fixed.
- TypeScript 6.0.3 (resolved via `"latest"`) deprecates `moduleResolution: "node10"` and requires `module`/`moduleResolution` to match when using `Node16`. Root `tsconfig.base.json` uses `module: "Node16"`, `moduleResolution: "Node16"` for all backend packages/apps/worker; `apps/web`'s own `tsconfig.json` overrides `module`/`moduleResolution`/`jsx` etc. as required by Next.js (16.2.10 resolved via `"latest"`), extending the base only for strict-mode options.
- Prisma resolved to **7.8.0** (`latest`), a major with breaking setup changes vs. the Unit 03 spec's v6 assumptions. Adaptations (consistent with the repo's use-`latest`-and-adapt approach from Units 01–02): (a) datasource block carries only `provider` — connection URLs moved to `packages/db/prisma.config.ts` (`defineConfig`, loads root `.env` via `dotenv`, reads `DIRECT_URL`/`DATABASE_URL` with an empty fallback so offline `validate`/`generate` don't throw); (b) generator is `prisma-client` (not `prisma-client-js`), requires an explicit `output` and emits TypeScript to `packages/db/src/generated/prisma` (gitignored) with `moduleFormat = "cjs"` — CJS is mandatory because the package is CommonJS and the default ESM output uses `import.meta.url`, which breaks once tsc compiles it to CJS; (c) the runtime client connects through a driver adapter — `new PrismaClient({ adapter: new PrismaPg(DATABASE_URL) })` — adding `@prisma/adapter-pg` + `pg`; (d) imports come from the generated output (`./generated/prisma/client.js`, Node16 `.js` specifiers), re-exported from `@kol-fit/db`; (e) `dotenv` (not `dotenv-cli`) loads env inside the config file. The spec's Implementation Note documents this as authoritative.
- This background job's worktree-isolation guard could not be satisfied because Unit 01 requires an initial `git init` with zero commits, so `EnterWorktree` had no ref to branch from (unborn HEAD). Per explicit user approval, `.claude/settings.json` was set to `{"worktree": {"bgIsolation": "none"}}` to work directly in the checkout instead. That setting did not take effect mid-session (isolation state appears cached at session start), so all Unit 01 file creation/edits were done via Bash (heredocs) rather than the Write/Edit tools, which remained blocked for the rest of this session.

## Session Notes
- 2026-07-07: Created `context/specs/02-ui-theme-and-app-shell.md` per explicit request. Spec scopes Tailwind setup, the `ui-context.md` dark token system, app shell (top nav + centered content), and a static placeholder landing page only — no analysis form, API routes, DB, worker changes, or provider/scoring logic. Not yet implemented.

- The first version should be real and deep, not a toy MVP.
- The system should still avoid unnecessary infra cost because it will not have hundreds of concurrent users at the start.
- Do not build KOL discovery yet.
- Do not build campaign CRM yet.
- Do not run full analysis inside a Next.js API route.
- Prioritize architecture that can grow into an internal agency tool and later a SaaS product.
- 2026-07-07: Resolved all prior open questions (package manager, git init timing, auth scope, report persistence timing, LLM model configurability, analysis depth/cost caps, raw payload retention, website/docs ingestion scope, AGENTS.md/CLAUDE.md alignment). Updated `architecture.md`, `code-standards.md`, `ai-workflow-rules.md`, `project-overview.md`, `AGENTS.md`, and `context/specs/00-build-plan.md` accordingly. Build plan gained a new Unit 12 (Website/Docs Content Fetch Module); all units from the former Unit 12 onward shifted by +1 (now Units 13-21). Created `context/specs/01-project-scaffold.md`.
- 2026-07-07: Implemented and verified Unit 01 (Repository Scaffold and Tooling). All verification checklist items in `context/specs/01-project-scaffold.md` pass. No commits were made to the new git repository, per instruction.
- 2026-07-08: Implemented and verified Unit 02 (UI Theme and App Shell). See the Completed entry above; `context/specs/02-ui-theme-and-app-shell.md`.
- 2026-07-08: Implemented and verified Unit 03 (Prisma Database Schema) in `packages/db`. Offline verification passes (`prisma validate`/`format`/`generate`, runtime export smoke test, `pnpm build`); live-DB steps (`migrate dev`, connection test) deferred pending Supabase credentials — no migration generated yet. Resolved Prisma 7.8.0 forced setup adaptations (config-file datasource, `prisma-client` generator with cjs output, driver adapter) — see Architecture Decisions. `next-env.d.ts` shows an unrelated Next-managed churn line (dev↔build routes-types path) from running `next build`. No commits made.
- 2026-07-08: Created `context/specs/03-prisma-database-schema.md` per explicit request (spec only, not implemented). Scopes Prisma setup in `packages/db`, the initial Supabase Postgres schema, client generation, and DB package exports. Models: `Workspace`, `AnalysisRequest`, `AnalysisJob`, `OrgProfile`, `KolProfile`, `Report`, `ReportEvidence`, optional `EngagedAccountSample`, `ProviderUsageLog`. Enums: `JobStatus`, `ReportStatus`, `ReportVerdict`, `EngagementSource`. Workspace-ready (nullable `workspaceId` on request + report), reports persisted from day one, deterministic `scores` kept separate from LLM `report` JSON, no raw-payload columns, indexes for workspace/history + job status + org/KOL handle + `createdAt`. New deps at implementation: `prisma`, `@prisma/client`, `dotenv-cli` (root-`.env` loading for the Prisma CLI). No new env vars (`DATABASE_URL`/`DIRECT_URL` already in `.env.example`). No queue/worker/provider/LLM/scoring/API/UI logic. Reconciliation with `architecture.md` model names recorded as an open item above.
