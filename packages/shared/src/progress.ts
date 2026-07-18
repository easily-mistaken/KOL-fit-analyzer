import { z } from "zod";

// Live analysis progress (the waiting screen). Written incrementally by the
// worker as the pipeline clears real stage boundaries, persisted on
// AnalysisJob.progress, and surfaced through GET /api/analyses/[id]. This makes
// the ~5-7 min wait feel like real work on the user's *own* creator instead of
// a fake spinner.
//
// REDACTION (Unit 33): the client must never see internal mechanics. So this
// carries ONLY things a user already gets in the finished report — public
// profile facts (handle/name/followers/verified/avatar) and audience *shares* —
// never raw pipeline counts (posts pulled, accounts sampled/classified),
// provider names, or model ids.

// The four user-facing stages, in order. `stageIndex` is the 0-based position of
// the stage now IN PROGRESS (so "reading" done -> stageIndex 1 = "measuring").
export const ANALYSIS_STAGE_KEYS = [
  "reading", // reading the public presence
  "measuring", // measuring the real audience (the slow deep pass)
  "quality", // evaluating audience quality & fit
  "report", // preparing the report
] as const;

export const AnalysisStageSchema = z.enum(ANALYSIS_STAGE_KEYS);
export type AnalysisStage = z.infer<typeof AnalysisStageSchema>;

// A public, report-safe glimpse of one account. Every field optional so a
// provider that omits a datum degrades gracefully rather than failing.
export const ProfileGlimpseSchema = z.object({
  handle: z.string(),
  displayName: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  followersCount: z.number().int().nonnegative().nullable().optional(),
  verified: z.boolean().nullable().optional(),
});
export type ProfileGlimpse = z.infer<typeof ProfileGlimpseSchema>;

// One slice of the audience "taking shape" — a folded segment label + its
// share. Shares are already client-visible in the finished report, so showing
// them forming live reveals nothing new; it previews the payoff.
export const AudienceGlimpseSchema = z.object({
  label: z.string(),
  share: z.number().min(0).max(1),
  low: z.boolean().optional(),
});
export type AudienceGlimpse = z.infer<typeof AudienceGlimpseSchema>;

export const AnalysisProgressSchema = z.object({
  stage: AnalysisStageSchema,
  stageIndex: z.number().int().min(0).max(ANALYSIS_STAGE_KEYS.length - 1),
  updatedAt: z.string(), // ISO
  org: ProfileGlimpseSchema.nullable().optional(),
  kol: ProfileGlimpseSchema.nullable().optional(),
  // Top folded audience segments, largest-first. Present once classification
  // has produced a first read of who actually engages.
  audience: z.array(AudienceGlimpseSchema).optional(),
});
export type AnalysisProgress = z.infer<typeof AnalysisProgressSchema>;
