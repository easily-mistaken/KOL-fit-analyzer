# Unit 01: Repository Scaffold and Tooling

## Goal

Stand up the base monorepo structure and tooling for Crypto KOL Fit Analyzer with no product logic yet. At the end of this unit, the workspace builds, the web app starts, the worker package compiles, and a shared package can be imported from both — nothing more.

Explicit non-goals for this unit (covered by later units, do not implement here):

- No Tailwind/shadcn/UI theme (Unit 02).
- No Prisma schema or database connection (Unit 03).
- No Zod schemas or API response helpers (Unit 04).
- No API routes, pg-boss, or job processing (Units 05-07).
- No real logic inside `packages/db`, `packages/twitter`, `packages/llm`, `packages/analysis`, `packages/scoring` — these exist only as compilable, empty-but-valid package skeletons.

## Design / Structure Notes

- Monorepo managed via **pnpm workspaces** (per `architecture.md` and `code-standards.md` — Package Manager). No npm/yarn commands or lockfiles.
- Repository structure follows `architecture.md` exactly:

  ```txt
  apps/
    web/
    worker/

  packages/
    db/
    twitter/
    llm/
    analysis/
    scoring/
    shared/

  context/
    specs/
  ```

- Git is initialized as part of this unit with a standard `.gitignore`. **Do not create any commits** — leave the working tree staged/unstaged as-is unless the user explicitly asks for a commit.
- Every `apps/*` and `packages/*` folder is its own pnpm workspace package with its own `package.json` and `tsconfig.json` extending a shared root `tsconfig.base.json` (TypeScript strict mode, per `code-standards.md`).
- `packages/shared` is the only package with real (if trivial) content in this unit — a single exported constant/type — used purely to prove that workspace-linked imports resolve correctly from both `apps/web` and `apps/worker`. This is not the start of real shared schemas (that's Unit 04).
- `apps/web`'s default page and `apps/worker`'s entry file each import from `packages/shared` and surface the value (page text / console log) as the workspace-import proof. Do not build real UI or job-handling here — Unit 02 will replace the page content with the themed app shell, and Unit 07 will replace the worker entry with real pg-boss handler registration.
- Root `package.json` is private (`"private": true`) and exposes workspace-aware scripts only (e.g. `pnpm -r build`, `pnpm --filter web dev`). No Turborepo or other build-orchestration tool is introduced — not needed yet, and code-standards.md says not to add dependencies before a unit needs them.
- `.env.example` is created at the repo root listing the variables documented in `code-standards.md` (`DATABASE_URL`, `DIRECT_URL`, `TWITTERAPI_IO_KEY`, `OPENAI_API_KEY`, `LLM_MODEL`, `NEXT_PUBLIC_APP_URL`), even though most are unused until later units — this documents the eventual full set up front.

## Implementation Steps

1. **Git init**
   - Run `git init` at the repo root.
   - Add a standard Node/TypeScript/Next.js `.gitignore` (`node_modules`, `.next`, `dist`, `.env`, `.env.local`, `*.log`, `.DS_Store`, etc.).
   - Do not commit.

2. **pnpm workspace setup**
   - Add `pnpm-workspace.yaml` at the root covering `apps/*` and `packages/*`.
   - Add root `package.json`: `"private": true"`, `packageManager` field pinned to the installed pnpm version, and scripts:
     - `build`: `pnpm -r build`
     - `lint`: `pnpm -r --if-present lint`
     - `dev:web`: `pnpm --filter web dev`
     - `dev:worker`: `pnpm --filter worker dev`

3. **Root TypeScript config**
   - Add `tsconfig.base.json` at the root with strict mode enabled (`strict: true`, `noImplicitAny`, etc.) and shared compiler options (module resolution, target, `skipLibCheck`, etc.).
   - Each package/app's `tsconfig.json` extends this base and sets its own `outDir`/`rootDir`/`include`.

4. **`packages/shared` skeleton**
   - `package.json` with a workspace-scoped name (e.g. `@kol-fit/shared`), `main`/`types` pointing at build output.
   - `src/index.ts` exporting one trivial named constant (e.g. `APP_NAME`) — a placeholder proving the package is real and importable, not the start of the real shared-schema surface.
   - Build script compiles via `tsc`.

5. **`packages/db`, `packages/twitter`, `packages/llm`, `packages/analysis`, `packages/scoring` skeletons**
   - Each gets a minimal `package.json` (workspace-scoped name), `tsconfig.json` extending the root base, and a `src/index.ts` with a single placeholder named export (or empty export) so the package compiles.
   - No Prisma, no provider interfaces, no scoring functions, no analysis stages yet — those arrive in their respective later units.

6. **`apps/web` scaffold**
   - Scaffold a Next.js + TypeScript app (App Router) named `web` inside `apps/web`, added to the pnpm workspace, depending on `@kol-fit/shared` via the workspace protocol.
   - No Tailwind/shadcn yet — plain default styling only.
   - Default page imports the placeholder constant from `packages/shared` and renders it as plain text, proving the import resolves at build and runtime.

7. **`apps/worker` scaffold**
   - Create a minimal Node.js + TypeScript app in `apps/worker`, depending on `@kol-fit/shared` via the workspace protocol.
   - `src/index.ts` imports the placeholder constant from `packages/shared`, logs a "worker booted" message including it, and exits (or idles briefly) — no pg-boss, no DB connection, no job handlers yet.
   - Use `tsx` (dev dependency) for local dev running, `tsc` for build output.

8. **Environment example file**
   - Add `.env.example` at the repo root listing `DATABASE_URL`, `DIRECT_URL`, `TWITTERAPI_IO_KEY`, `OPENAI_API_KEY`, `LLM_MODEL`, `NEXT_PUBLIC_APP_URL` with placeholder/empty values and short comments.

9. **Install and verify**
   - `pnpm install` at the root.
   - `pnpm build` builds all packages/apps successfully.

## Dependencies Introduced

- `next`, `react`, `react-dom`, `typescript` (in `apps/web`)
- `@types/node`, `typescript`, `tsx` (in `apps/worker`)
- `typescript` (root/shared dev tooling as needed per package)
- pnpm workspace tooling (`pnpm-workspace.yaml`, workspace `package.json` scripts)

Explicitly not introduced yet: Tailwind, shadcn/ui, Lucide, Prisma, pg-boss, Zod, OpenAI SDK, TwitterAPI.io client — each arrives in its designated later unit.

## Verification Checklist

- [ ] Git repository is initialized at the repo root with a `.gitignore` in place; no commits exist unless the user explicitly requested one.
- [ ] `pnpm-workspace.yaml` correctly includes `apps/*` and `packages/*`.
- [ ] `pnpm install` completes without errors.
- [ ] `pnpm build` passes across every package and app.
- [ ] `apps/web` starts locally (`pnpm --filter web dev`) and its default page renders the value imported from `packages/shared`.
- [ ] `apps/worker` compiles and, when run, logs the "worker booted" message including the value imported from `packages/shared`.
- [ ] `packages/db`, `packages/twitter`, `packages/llm`, `packages/analysis`, `packages/scoring` each compile as empty-but-valid TypeScript packages.
- [ ] `.env.example` exists at the root and lists `DATABASE_URL`, `DIRECT_URL`, `TWITTERAPI_IO_KEY`, `OPENAI_API_KEY`, `LLM_MODEL`, `NEXT_PUBLIC_APP_URL`.
- [ ] No Tailwind/shadcn, Prisma, pg-boss, Zod, or provider logic was added in this unit.
- [ ] `context/progress-tracker.md` is updated to reflect Unit 01 completion once implementation lands.
