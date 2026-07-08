# AGENTS.md

## Application Building Context

Before implementing or making any architectural decision, read these files in order:

1. `context/project-overview.md` — product definition, goals, core user flow, feature scope, and success criteria
2. `context/architecture.md` — stack, system boundaries, storage model, background jobs, provider abstractions, and invariants
3. `context/ui-context.md` — visual language, layout rules, component conventions, colors, typography, and report UI patterns
4. `context/code-standards.md` — TypeScript, API, database, worker, provider, scoring, and LLM implementation rules
5. `context/ai-workflow-rules.md` — development workflow, scoping rules, missing requirement handling, protected files, and verification rules
6. `context/progress-tracker.md` — current phase, completed work, open questions, architecture decisions, and next implementation unit
7. `context/specs/00-build-plan.md` — ordered build units for the first complete version

## Required Behavior

- Always implement against the context files and the current unit spec.
- Do not invent product behavior that is not defined in the context files or the active spec.
- Work on one feature unit at a time.
- Keep implementation small, verifiable, and scoped.
- If a requirement is ambiguous, add it to `context/progress-tracker.md` under Open Questions before implementing.
- Update `context/progress-tracker.md` after every meaningful implementation change.
- If implementation changes architecture, storage, scope, or standards, update the relevant context file before continuing.
- Do not run long-running analysis inside request/response API routes. API routes create jobs; workers execute jobs.

## Verification Rule

Before marking any unit complete:

1. The unit works end to end within its defined scope.
2. No invariant in `context/architecture.md` is violated.
3. `context/progress-tracker.md` reflects the current state.
4. `pnpm build` passes.
5. No unrelated files or features were modified.
