# Unit 33: Client-Facing Methodology Redaction

User direction (2026-07-16): the client-facing UI must not reveal how outputs
are computed — the "secret sauce" (pipeline stages, sample mechanics, provider/
model names, scoring weights/baselines/formulas) — nor internal artifacts like
the analysis id on the waiting page. **Nothing changes in what is persisted**:
scores, reasons, evidence, and sample sizes remain in the DB (the internal
intelligence asset, visible via admin/DB) — only the public render is trimmed.

## Redactions

1. **Waiting page** (`analysis-status.tsx`): request id removed from the
   header and the running panel; the staged walkthrough keeps its timing/
   marketing value but the copy becomes outcome-language — no post counts,
   API-call counts, account-classification counts, batch mechanics, or
   "deterministic scoring across nine metrics".
2. **Report page** (`fit-report-view.tsx`):
   - "Evidence & sample" section removed (sample-size grid + evidence notes —
     which named providers, models, ingestion status, and scoring approach).
     Replaced by a slim footer: overall confidence + generated date only.
   - Sample chips removed from the hero (post/engaged/classified counts).
   - "What works / what to watch" no longer quotes raw scoring `reasons`
     strings (they describe calibration mechanics: damping, floors, target
     derivation); the label + score communicate the driver.
3. **Audience donut** (`audience-donut.tsx`): center no longer shows the
   classified-count (reveals the classification cap); shows a neutral
   "Engaged audience" label. Hover percentages stay (product output).
4. **Metric bars** (`metric-groups.tsx`): scoring WEIGHTS removed (they were
   also stale — pre-29E values).
5. **Metric ⓘ explainers** (`metric-info.ts`): rewritten to say what each
   metric tells the reader and how to act on it — no baselines, curves,
   thresholds, damping, exclusions, or weighting mechanics.

Kept client-visible: verdict, scores, confidence level, audience breakdown
shares, all LLM narrative, takeaways, recommendations, failed-state error
codes (support value). The FitReport schema and persistence are untouched.

## Verification

`pnpm build` green; source-level leak sweep (no weights/provider/model/
sample-count renders in the client components); manual visual pass by the
user. `project-overview.md` success criterion 8 (evidence/sample shown on
every report) is superseded for the PUBLIC surface — noted there.
