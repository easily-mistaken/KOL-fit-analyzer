# AI Workflow Rules

## Approach

Build this project incrementally using a spec-driven workflow. Context files define what to build, how to build it, and the current state of progress. Always implement against these specs. Do not infer or invent behavior from scratch.

The project is a serious but lean crypto KOL analysis system. It must preserve clear boundaries between UI, API routes, background jobs, provider integrations, scoring logic, LLM logic, and database persistence.

## Scoping Rules

- Work on one feature unit at a time.
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single implementation step.
- Do not implement future features unless the active spec explicitly includes them.
- Do not add dependencies until the current unit needs them.
- Do not refactor unrelated code while implementing a feature unit.
- Do not replace architectural decisions from `architecture.md` without explicit instruction.

## When to Split Work

Split an implementation step if it combines:

- UI changes and background worker changes.
- Database schema changes and complex report UI changes.
- Multiple unrelated API routes.
- Provider integration and frontend rendering.
- Scoring logic and LLM prompt/report generation.
- Auth/workspace changes with analysis pipeline changes.
- Behavior not clearly defined in the context files.

If a change cannot be verified end to end quickly, the scope is too broad. Split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the context files.
- If a requirement is ambiguous, add it as an open question in `context/progress-tracker.md` before implementing.
- If a requirement is missing but blocks the current unit, stop and request clarification.
- If a requirement is missing but does not block the current unit, proceed only with the defined scope and record the missing item in `progress-tracker.md`.
- If implementation reveals a new architecture decision, record it in `progress-tracker.md` and update `architecture.md` if the decision affects system boundaries or invariants.

## Protected Files

Do not modify the following unless explicitly instructed:

- `components/ui/*` or `apps/web/components/ui/*` generated shadcn/ui primitives, except normal CLI-generated additions.
- third-party library internals.
- lockfiles except when dependencies are intentionally added.
- environment files containing secrets.
- generated Prisma client files.
- migration files after they have been applied, unless explicitly instructed.

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- System architecture or boundaries → `context/architecture.md`
- Storage model or schema assumptions → `context/architecture.md`
- Code conventions or standards → `context/code-standards.md`
- Feature scope → `context/project-overview.md`
- UI design system → `context/ui-context.md`
- Current phase, completed work, open questions, or session notes → `context/progress-tracker.md`

`context/progress-tracker.md` must be updated after every meaningful implementation change.

## Implementation Discipline

- Read the active spec before changing code.
- Implement exactly what the spec asks for.
- Do not go beyond the current unit.
- Prefer mock data mode before live provider integration.
- Keep deterministic metrics separate from LLM reasoning.
- Keep long-running work out of API routes.
- Keep provider-specific code behind provider interfaces.
- Keep frontend rendering separate from scoring calculations.

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope.
2. No invariant defined in `architecture.md` was violated.
3. `progress-tracker.md` reflects the completed work.
4. New open questions are recorded.
5. New architecture decisions are recorded.
6. `pnpm build` passes.
7. No unrelated files were changed.
8. The user-visible behavior matches the active spec.
