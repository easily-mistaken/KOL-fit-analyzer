# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 1: Project Foundation — Units 01–02 complete

## Current Goal

- Implement Unit 03 (Database Schema / Prisma) next.

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

## In Progress

- None. Unit 02 complete and verified.

## Next Up

- Unit 03: Prisma Database Schema — spec written at `context/specs/03-prisma-database-schema.md`; implementation not started.

## Open Questions

- Unit 03 spec renames/consolidates `architecture.md`'s *Suggested Database Models* (`OrgSnapshot`→`OrgProfile`, `KolSnapshot`→`KolProfile`, `AnalysisReport`→`Report`; `ScoreBreakdown`/`AudienceClassificationSummary` folded into `Report` JSON columns + `ReportEvidence`; `EngagedAudienceSample`→`EngagedAccountSample`). When Unit 03 is implemented, update `architecture.md` → *Suggested Database Models* to these concrete names so docs match the schema. Not a blocker — recorded so the doc sync isn't forgotten.
- Prisma client generator `output`: spec defaults to the standard `@prisma/client` import; if the resolved Prisma version requires an explicit `output`, adapt at implementation time (custom package-local path + re-export), mirroring how Units 01–02 adapted to resolved tool versions.
- Live-DB verification (migrate/apply, connection smoke test) requires real Supabase `DATABASE_URL`/`DIRECT_URL`. If unavailable at implementation time, offline verification (`prisma validate` + `prisma generate` + `pnpm build`) is the fallback and the online steps are deferred.
- Prior session's open questions remain resolved (see Architecture Decisions below). None block writing/implementing Unit 03.

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
- 2026-07-08: Created `context/specs/03-prisma-database-schema.md` per explicit request (spec only, not implemented). Scopes Prisma setup in `packages/db`, the initial Supabase Postgres schema, client generation, and DB package exports. Models: `Workspace`, `AnalysisRequest`, `AnalysisJob`, `OrgProfile`, `KolProfile`, `Report`, `ReportEvidence`, optional `EngagedAccountSample`, `ProviderUsageLog`. Enums: `JobStatus`, `ReportStatus`, `ReportVerdict`, `EngagementSource`. Workspace-ready (nullable `workspaceId` on request + report), reports persisted from day one, deterministic `scores` kept separate from LLM `report` JSON, no raw-payload columns, indexes for workspace/history + job status + org/KOL handle + `createdAt`. New deps at implementation: `prisma`, `@prisma/client`, `dotenv-cli` (root-`.env` loading for the Prisma CLI). No new env vars (`DATABASE_URL`/`DIRECT_URL` already in `.env.example`). No queue/worker/provider/LLM/scoring/API/UI logic. Reconciliation with `architecture.md` model names recorded as an open item above.
