# Unit 37: Accuracy-Booster Form Section

User direction (2026-07-16): instead of a goal-conditional report surface,
make the analysis form's optional-context section visibly valuable — users
should understand that filling these fields produces sharper, more accurate
results. (The Unit 32 goal-conditional engine benefits automatically when a
campaign goal is actually supplied.)

## Changes (apps/web/components/analysis-form.tsx only)

- The muted "Add optional context" ghost toggle becomes a full-width
  accent-styled card: Sparkles icon, "Sharpen your results" headline, a
  "Recommended" chip, and honest benefit copy ("the analysis calibrates to
  YOUR target audience and campaign goal instead of generic assumptions").
- Open-state microcopy reframed ("every field you fill makes the verdict
  more yours").
- Field-level hints on the highest-impact inputs: website URL ("helps us
  understand your product"), campaign goal ("changes the verdict"), target
  user ("the audience we match against"). Outcome language only — no
  methodology (consistent with Unit 33).

## Verification

Web build green; visual pass by the user. No API/schema/scoring changes.
