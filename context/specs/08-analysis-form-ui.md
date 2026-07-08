# Unit 08: Analysis Form UI

## Goal

Build the first real user-facing flow: an analysis request form in `apps/web` that collects the org + KOL handles and optional org context, validates them, submits to the existing `POST /api/analyses`, and on success routes the user to the analysis's status page path. This is the "User opens the analysis form … submits the request" entry point from `project-overview.md`'s core flow, rendered in the dark analyst-dashboard UI system.

The API route (Unit 05/06) and the worker (Unit 07) already exist and are unchanged here — this unit is purely the front-end form and its wiring.

Explicit non-goals for this unit (later units own these):

- **No real report status page** (Unit 09). This unit only adds a clearly-marked **temporary placeholder** landing page as the redirect target (see *Success Behavior*) so the redirect isn't a 404. No polling, no report rendering, no data fetching there.
- No saved-reports list / dashboard (Unit 20), no report renderer (Unit 15).
- No auth, no share links, no export.
- No database, worker, queue, provider, LLM, scoring, or pipeline changes.
- No API route changes (the form consumes the existing route as-is).
- No commits.

## UI / UX Design

Follows `ui-context.md` → *Layout Patterns → Analysis Form* and the existing theme tokens (no hardcoded hex; reuse `bg-surface`, `border-default`, `text-*`, accent, etc.).

- **Placement:** the form is the primary content of the **home route `/`**. `app/page.tsx` keeps the hero (product name via `APP_NAME` + the positioning line) and replaces the static "No reports yet" preview card (a Unit 20 stand-in) with the real `<AnalysisForm />`. (Unit 20 may later reorganize `/` into a dashboard; that's out of scope now.)
- **Container:** the form lives inside a `Card` panel (`rounded-xl`), centered within the existing app-shell `max-w-5xl` main column; the form card itself is narrower (e.g. `max-w-2xl`) for readability.
- **Structure (matches the ui-context Analysis Form pattern):**
  - **Primary inputs at top:** `org handle` and `KOL handle`, prominent, in a 2-column grid on desktop and stacked on mobile.
  - **Optional context** in a secondary, collapsed-by-default section revealed by an "Add optional context" toggle (client `useState`, no new primitive) — keeps the default view focused; the heading notes it "improves accuracy".
  - **Submit button** at the bottom, primary accent, clearly labeled to indicate analysis creation (e.g. "Run analysis"), with a leading lucide icon (`Search` or `Sparkles`, `h-4 w-4`).
- **Server/Client split:** `app/page.tsx` stays a Server Component and renders the Client Component `components/analysis-form.tsx` (`"use client"`), which owns all state, validation, submission, and navigation.
- **Reusability:** the form is a self-contained reusable component; a small internal field-row helper (label + control + inline error) keeps the markup consistent. Do not overbuild beyond this form.
- **Icons:** Lucide only, following the `h-4 w-4` / `h-5 w-5` sizing rule.

## Form Fields

All field names match the shared `AnalysisRequestInput` / `AnalysisRequest` columns exactly.

| Field | Name | Control | Required | Constraint (from shared schema) |
| --- | --- | --- | :--: | --- |
| Organization handle | `orgHandle` | Input (text) | ✅ | Twitter/X handle: `@` optional, 1–15 of `[A-Za-z0-9_]` |
| KOL handle | `kolHandle` | Input (text) | ✅ | same handle rule |
| Website URL | `websiteUrl` | Input (`type="url"`) | — | valid URL |
| Docs URL | `docsUrl` | Input (`type="url"`) | — | valid URL |
| Product category | `productCategory` | Input (text) | — | 1–120 chars |
| Target user | `targetUser` | Textarea (2–3 rows) | — | 1–280 chars |
| Campaign goal | `campaignGoal` | Select | — | free string; options from `CAMPAIGN_GOAL_LABELS` (value = machine value, e.g. `awareness`) |
| Stage | `stage` | Select | — | free string; options from `PRODUCT_STAGE_LABELS` (value = machine value, e.g. `pre_launch`) |
| Region / language | `region` | Input (text) | — | 1–120 chars |

Notes:

- `campaignGoal` and `stage` reuse the shared `CAMPAIGN_GOAL_LABELS` / `PRODUCT_STAGE_LABELS` from `@kol-fit/shared` to render a dropdown of known values (each with a "— none —" default that submits nothing). The request schema accepts these machine values as free strings, so no schema change is needed and the stored value stays canonical.
- Handles show an `@` affordance in the placeholder (e.g. `@myorg`); the schema strips a leading `@` on the server.
- `workspaceId` is never a form field (auth out of scope).

## Validation Behavior

The shared schema is the source of truth — the client reuses it so field names and constraints never drift from the server.

- **Reuse `AnalysisRequestInputSchema`** (imported from `@kol-fit/shared`; it is pure Zod and safe in the client bundle) to validate on submit.
- **Payload assembly:** build an object with `orgHandle`/`kolHandle` plus **only the non-empty** optional fields (empty optionals are omitted, not sent as `""`, since the schema requires `min(1)` when present).
- **On submit:** run `AnalysisRequestInputSchema.safeParse(payload)`. If it fails, map each issue to its field (`issue.path[0]`) and render an inline error under that control; focus/scroll is optional. **Do not** call the API when invalid.
- **Required-field feedback:** empty `orgHandle`/`kolHandle` produce their handle-rule error from the same schema (empty string fails the pattern), so no separate required logic is needed — but a friendly "Organization handle is required" message may be substituted for the empty case.
- Validation runs on submit (not necessarily on every keystroke); clearing a field's error on change is a nice-to-have.
- The server re-validates independently (defense in depth); the client validation is UX only.

## Submit Behavior

1. `onSubmit` (form `onSubmit`, prevent default): clear previous form-level and field errors, set `loading = true`, disable inputs + submit button.
2. Assemble + client-validate the payload (above). If invalid: show field errors, set `loading = false`, stop.
3. `fetch("/api/analyses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })`.
4. Parse the JSON body as the shared `ApiResponse<{ id: string; jobId: string; status: string; createdAt: string }>` shape.
5. Branch on `body.ok` (see Success/Error). Always clear `loading` before navigating or showing an error.

- **Loading UX:** submit button shows a spinning lucide `Loader2` + "Analyzing…" and is disabled; inputs disabled to prevent double-submit.
- Handles are sent as typed (trimmed); the server normalizes them.

## Success Behavior

- On `body.ok === true`: navigate to the analysis's status page using `useRouter().push(\`/analyses/${body.data.id}\`)` (from `next/navigation`).
- **Canonical destination route: `/analyses/[id]`** (mirrors the `/api/analyses` resource; `id` = `AnalysisRequest.id`). Unit 09 implements the real polling status + report page here.
- **Temporary placeholder page (this unit):** add `app/analyses/[id]/page.tsx` as a minimal Server Component that reads `params.id` and renders a `Card` confirming submission — e.g. "Analysis queued", the id in `font-mono`, and a muted note "Live status and the report will appear here." **No polling, no data fetch, no report rendering** — it is explicitly the temporary stand-in that Unit 09 replaces. This keeps the post-submit redirect functional instead of 404ing.
- Do not clear the form before navigation (navigation unmounts it anyway).

## Error Behavior

- **Client validation errors:** inline, per-field, under each control (from the Zod issues). No API call made.
- **API error (`body.ok === false`):** render a form-level error panel (using `state-error`/`border` tokens, not raw hex) showing `body.error.message` (already user-safe from the route). Keep entered values; re-enable the form. Example triggers: 400 `validation_error` (shouldn't happen given client validation, but handled), 500 `internal_error` (e.g. DB/queue unavailable).
- **Network/parse failure (fetch throws or non-JSON):** show a generic "Something went wrong. Please try again." panel; re-enable the form. Never surface raw exception text.
- **HTTP status handling:** branch on the parsed `ok` flag rather than the status code, but treat a non-OK status with an unparseable body as the network/parse case.
- Errors never leak server internals (the route already sanitizes; the client shows `error.message` only).

## Implementation Steps

1. **Add shadcn primitives** used by the form to `apps/web/components/ui/` (hand-authored to match the existing Unit 02 primitives / same token system, or via the shadcn CLI): `Input`, `Textarea`, `Label`, `Select`. Install their peer deps: `@radix-ui/react-label`, `@radix-ui/react-select` (Input/Textarea are dependency-free). These are the "expected components" ui-context deferred to the unit that renders them — this is that unit.
2. **`components/analysis-form.tsx`** (`"use client"`): the form with all fields, the "Add optional context" toggle, client validation via `AnalysisRequestInputSchema`, submit-to-`/api/analyses`, loading state, field + form-level error rendering, and success redirect via `next/navigation`.
3. **`app/page.tsx`** (Server Component): keep the hero; render `<AnalysisForm />` in place of the static empty-state preview.
4. **`app/analyses/[id]/page.tsx`** (Server Component): the temporary placeholder landing page described in *Success Behavior*, clearly marked as a Unit 09 stand-in.
5. **Reuse tokens/primitives** — no hardcoded hex; consume `Card`, `Button`, `Badge`/`Separator` as needed alongside the new primitives.
6. **Do not touch** `packages/*`, `apps/worker`, the API route, or the Prisma schema.

## Dependencies

- New shadcn UI primitives in `apps/web/components/ui/`: `Input`, `Textarea`, `Label`, `Select`.
- New npm peer deps in `apps/web`: `@radix-ui/react-label`, `@radix-ui/react-select`. (`lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge` already present.)
- Reused, no new install: `@kol-fit/shared` (schema + vocab), the existing `/api/analyses` route.
- Explicitly **not** introduced: form libraries (react-hook-form etc. — plain React state is sufficient), any provider SDK, auth.

## Verification Checklist

### Offline (no `DATABASE_URL`)

- [ ] `pnpm build` passes across all workspace projects (form, new primitives, and placeholder page compile).
- [ ] Only `Button`, `Card`, `Badge`, `Separator`, `Input`, `Textarea`, `Label`, `Select` exist in `apps/web/components/ui/`; no component contains a hardcoded hex.
- [ ] Dev server: `/` renders the analysis form in the dark theme — required `orgHandle`/`kolHandle` visible; optional fields hidden until the "Add optional context" toggle is opened; `campaignGoal`/`stage` show the known options.
- [ ] Submitting with empty required fields shows inline validation errors and makes **no** network request.
- [ ] Invalid handle (e.g. `bad handle!`) and invalid URL show inline field errors from the shared schema.
- [ ] With no DB, a valid submit shows the form-level API error panel (from the route's 500 `internal_error`) and the form re-enables — confirming the loading + error states without a database.
- [ ] Loading state (disabled inputs + spinner) is visible during the request.

### Online (throwaway/local Postgres, schema applied)

- [ ] A valid submit returns 201 and the browser navigates to `/analyses/<id>`, where the temporary placeholder page renders the id and the "status coming in Unit 09" note.

### Scope guardrails

- [ ] No Prisma schema, worker, queue, provider, LLM, scoring, or pipeline changes; no API route change.
- [ ] No auth, no reports list, no share/export.
- [ ] `context/progress-tracker.md` updated once implemented.
- [ ] No commits made.
```
