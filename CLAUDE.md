# CLAUDE.md

## Application Building Context

Read the following files in order before implementing or making any architectural decision:

1. `context/project-overview.md` — product definition, goals, core user flow, features, and scope
2. `context/architecture.md` — system structure, boundaries, storage model, background jobs, and invariants
3. `context/ui-context.md` — theme, colors, typography, layout, and component conventions
4. `context/code-standards.md` — implementation rules and conventions
5. `context/ai-workflow-rules.md` — development workflow, scoping rules, and delivery approach
6. `context/progress-tracker.md` — current phase, completed work, open questions, and next steps
7. `context/specs/00-build-plan.md` — ordered build units

Update `context/progress-tracker.md` after each meaningful implementation change.

If implementation changes the architecture, scope, storage model, or standards documented in the context files, update the relevant file before continuing.

Do not infer or invent behavior beyond the active spec. When requirements are missing or ambiguous, record them as open questions before implementing.
