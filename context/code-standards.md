# Code Standards

## Package Manager

- Use pnpm and pnpm workspaces for the monorepo.
- Do not use npm or yarn commands or lockfiles.
- Root scripts must use pnpm-compatible workspace commands (e.g. `pnpm -r build`, `pnpm --filter <package> <script>`).
- Only one lockfile (`pnpm-lock.yaml`) should exist at the repo root.

## General

- Keep modules small, focused, and single-purpose.
- Prefer explicit boundaries over convenience imports.
- Fix root causes instead of layering workarounds.
- Do not mix unrelated concerns in one component, route, service, or worker function.
- Do not invent product behavior outside the active context/spec files.
- Favor readable, boring code over clever abstractions.
- Add abstractions only when they protect a real system boundary, such as Twitter/X providers or LLM providers.
- Keep deterministic metrics separate from LLM-generated reasoning.

## TypeScript

- TypeScript strict mode is required.
- Avoid `any`. Use explicit interfaces, Zod schemas, or narrow unknown values safely.
- External data must enter the system as `unknown` and be validated before use.
- Use discriminated unions for job states, report verdicts, and provider result statuses.
- Shared types and schemas belong in `packages/shared/`.
- Prefer named exports for shared modules.
- Avoid large files. Split files when multiple concerns emerge.

## Validation

- Use Zod for API request validation.
- Use Zod for provider response normalization when data comes from external APIs.
- Use Zod for LLM structured-output validation.
- Never trust LLM output until it passes schema validation.
- Return consistent validation errors from API routes.

## Next.js

- Use Next.js for UI, route handlers, and report pages.
- API routes should be thin.
- API routes may:
  - validate input
  - create analysis requests
  - enqueue jobs
  - read report status
  - return saved report data
- API routes must not:
  - fetch all Twitter/X data for a deep report
  - run LLM-heavy analysis
  - execute long-running analysis pipelines
  - contain scoring logic
- Use server components by default.
- Use client components only when browser interactivity is required.
- Keep page components focused on layout and data loading.
- Keep complex UI sections as separate components.

## Worker

- Long-running analysis must run in `apps/worker/`.
- Worker jobs must be idempotent where practical.
- Every job must update status transitions in the database.
- Worker failures must be stored with useful error context.
- Do not log secrets or full sensitive payloads.
- Worker stages should be composed from functions in `packages/analysis/`, `packages/twitter/`, `packages/llm/`, and `packages/scoring/`.
- Worker code should not import UI modules.

## API Routes

- Validate and parse request input before any logic runs.
- Enforce auth and ownership before mutations once auth exists.
- Return predictable response shapes:

```ts
{
  ok: true,
  data: ...
}
```

or

```ts
{
  ok: false,
  error: {
    code: string,
    message: string
  }
}
```

- Do not expose provider-specific raw errors directly to the client.
- Do not expose stack traces in production responses.

## Database

- Use Prisma for schema, migrations, and common CRUD.
- Use raw SQL only when Prisma is insufficient for analytics-heavy queries.
- Store structured report data in JSON fields only when the shape is validated and versioned.
- Store report schema version with each report.
- Store enough evidence and sample-size metadata to explain every score.
- Avoid storing unnecessary full raw data if a normalized summary is enough.
- Add indexes for fields used in status polling and report lookup.

## Background Jobs

- Use pg-boss for first-version background jobs.
- Do not add Redis/BullMQ until queue load justifies it.
- Analysis jobs must have statuses:
  - queued
  - running
  - completed
  - failed
- Store timestamps:
  - createdAt
  - startedAt
  - completedAt
  - failedAt
- Store retry count where available.
- Failed jobs should preserve enough context to debug safely.

## Provider Modules

- Provider modules must expose generic interfaces.
- Application code must depend on interfaces, not provider-specific clients.
- TwitterAPI.io-specific logic belongs only in the TwitterAPI.io provider implementation.
- OpenAI-specific logic belongs only in the OpenAI provider implementation.
- Provider outputs should be normalized before entering the analysis pipeline.
- Provider errors should be mapped to internal error codes.

## Scoring

- Scoring logic belongs in `packages/scoring/`.
- Scoring weights must be centralized and easy to change.
- UI must not recalculate scores.
- LLM should not invent numeric scores without deterministic inputs.
- The scoring module should produce:
  - score values
  - reasons/evidence signals
  - confidence impacts
- Overall score should prioritize engaged audience match.

Default weights:

| Metric | Weight |
| --- | ---: |
| Engaged audience match | 35% |
| Audience quality | 20% |
| Content fit | 15% |
| Campaign goal fit | 15% |
| Brand safety | 10% |
| Geo/language fit | 5% |

## LLM Usage

- Use LLMs for classification, synthesis, and explanation.
- Do not use LLMs for simple counts, ratios, or deterministic metrics.
- Provide LLMs with compact, structured evidence rather than large raw payloads.
- Require structured JSON output for report generation.
- Validate LLM output before saving.
- Store the model name and prompt/report schema version for debugging.
- If LLM output is invalid, retry with a repair prompt or fail gracefully.

## Styling

- Use Tailwind and shadcn/ui conventions.
- Use UI tokens defined in `ui-context.md`.
- Do not hardcode random hex values in components.
- Keep report UI readable and information-dense.
- Prefer cards, sections, badges, score blocks, and tables over decorative UI.
- Use responsive layouts for desktop and mobile.

## File Organization

- `apps/web/app/` — Next.js routes and layouts.
- `apps/web/components/` — app-specific UI components.
- `apps/web/components/ui/` — shadcn/ui generated components. Do not manually rewrite generated primitives unless explicitly instructed.
- `apps/web/lib/` — web-only helpers.
- `apps/worker/` — worker startup and job handler registration.
- `packages/db/` — Prisma schema/client and DB helpers.
- `packages/twitter/` — Twitter provider interface and implementations.
- `packages/llm/` — LLM provider interface and implementations.
- `packages/analysis/` — analysis orchestration and stage functions.
- `packages/scoring/` — scoring functions, weights, risk calculations.
- `packages/shared/` — shared schemas, types, constants.
- `context/` — project documentation and implementation specs.

## Error Handling

- Prefer explicit error codes.
- Map provider errors to internal error types.
- Store worker errors in job records.
- Show user-friendly errors in the UI.
- Do not swallow errors silently.
- Avoid retry loops without limits.

## Environment Variables

- Read secrets only from environment variables.
- Required environment variables should be documented in `.env.example`.
- Never commit `.env` files.
- Never expose server secrets to client bundles.

Expected variables may include:

```txt
DATABASE_URL
DIRECT_URL
TWITTERAPI_IO_KEY
OPENAI_API_KEY
LLM_MODEL
NEXT_PUBLIC_APP_URL
```

The LLM model name must never be hardcoded in provider code. Read it from `LLM_MODEL` and pass it into the LLM provider at call time or construction time. The exact model value is selected later, during the live OpenAI provider unit.

Analysis depth/cost caps (max posts, max replies per post, max engaged accounts, etc.) should live as centralized, overridable config constants (see `architecture.md` — Analysis Depth and Cost Controls). Expose environment variable overrides only where useful for local tuning; do not scatter magic numbers across pipeline stages.

## Testing and Verification

- Add tests for scoring functions when scoring logic becomes non-trivial.
- Add mock provider fixtures for Twitter/X data.
- Use mock data mode before relying on live provider calls.
- Verify every build unit with `pnpm build`.
- Do not mark a unit complete until the progress tracker is updated.
