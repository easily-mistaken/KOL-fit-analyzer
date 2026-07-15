import { z } from "zod";

import { AudienceAccountSchema, AudienceDistributionSchema } from "./audience.js";
import { ConfidenceLevelSchema } from "./scores.js";
import { AudienceBucketSchema } from "./vocab.js";

// Provider-neutral LLM structured outputs. These are the shapes an LLM provider
// (mock in Unit 11, OpenAI in Unit 17) must return; they must pass Zod
// validation before use or persistence (Invariants 3, 9, 12). Reuse the shared
// schemas rather than re-deriving. Unit 29B fields are additive optional so
// pre-v2 cached classifications and saved reports keep validating.

// The org's wanted audience buckets, inferred by the LLM (Unit 29B). Primary
// buckets are the core target; secondary are adjacent-but-valuable.
export const TargetBucketsSchema = z.object({
  primary: z.array(AudienceBucketSchema).default([]),
  secondary: z.array(AudienceBucketSchema).default([]),
});
export type TargetBuckets = z.infer<typeof TargetBucketsSchema>;

// Output of classifyOrgProfile. Manual brief fields on the request override
// these inferred fields (Invariant 7).
export const OrgClassificationSchema = z.object({
  productCategory: z.string().optional(),
  targetUser: z.string().optional(),
  stage: z.string().optional(),
  campaignGoal: z.string().optional(),
  region: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  targetBuckets: TargetBucketsSchema.optional(),
  confidence: ConfidenceLevelSchema,
});
export type OrgClassification = z.infer<typeof OrgClassificationSchema>;

// Per-post promo label (Unit 29B): the LLM labels each sampled post; promo
// SATURATION (share of promo posts) is computed deterministically in scoring,
// never by the model.
export const PostLabelSchema = z.object({
  postId: z.string(),
  isPromo: z.boolean(),
  /** Promo for a project inside the KOL's usual domain (vs unrelated shill). */
  promoRelated: z.boolean().optional(),
  promoQuality: z.enum(["low", "ok"]).optional(),
});
export type PostLabel = z.infer<typeof PostLabelSchema>;

// Explicit brand-safety flag with severity + concrete post evidence (Unit 29B).
export const BrandSafetyFlagKindSchema = z.enum([
  "scam_or_rug_association",
  "misleading_claims",
  "hate_or_harassment",
  "nsfw_content",
  "excessive_drama",
  "gambling_promotion",
  "legal_or_regulatory",
  "impersonation_or_deception",
]);
export type BrandSafetyFlagKind = z.infer<typeof BrandSafetyFlagKindSchema>;

export const BrandSafetyFlagSchema = z.object({
  flag: BrandSafetyFlagKindSchema,
  severity: z.enum(["low", "medium", "high"]),
  evidence: z.string(),
});
export type BrandSafetyFlag = z.infer<typeof BrandSafetyFlagSchema>;

// One label per attached post image (Unit 29B). Shares are aggregated
// deterministically downstream, never emitted by the model.
export const MediaLabelSchema = z.object({
  postId: z.string(),
  kind: z.enum([
    "chart_or_data",
    "screenshot_text",
    "meme",
    "promo_graphic",
    "photo_other",
  ]),
});
export type MediaLabel = z.infer<typeof MediaLabelSchema>;

// Output of classifyKolContent.
export const KolContentClassificationSchema = z.object({
  themes: z.array(z.string()).default([]),
  verticals: z.array(z.string()).default([]),
  style: z.string().optional(),
  depth: z.string().optional(),
  promoPatterns: z.array(z.string()).default([]),
  repeatedTickers: z.array(z.string()).default([]),
  postLabels: z.array(PostLabelSchema).optional(),
  brandSafetyFlags: z.array(BrandSafetyFlagSchema).optional(),
  mediaLabels: z.array(MediaLabelSchema).optional(),
});
export type KolContentClassification = z.infer<
  typeof KolContentClassificationSchema
>;

// The KOL's relationship to the org (Unit 29F) — a separate authority signal,
// not a weighted metric. Drives verdict floors/caps in scoring.
export const KolRelationshipSchema = z.enum([
  "founder_or_core_team",
  // Unit 32 (v26 hierarchy): publicly-known creator/lead/official operator of
  // the org's platform or ecosystem program — founder-grade authority whose
  // boost is conditional on the campaign goal.
  "official_ecosystem_lead",
  "adjacent_ecosystem_authority",
  "independent_specialist",
  "media_or_news",
  "none",
]);
export type KolRelationship = z.infer<typeof KolRelationshipSchema>;

// Output of assessContentFit (Unit 29B): a bounded pair-specific semantic
// rubric — labels on an ordinal 0-5 scale with rationale. The deterministic
// scoring module (29C) maps these to a 0-100 metric; the LLM never scores.
// 29F adds the org↔KOL relationship classification (additive optional).
export const ContentFitAssessmentSchema = z.object({
  /** How close the KOL's usual topics are to the org's domain. */
  topicalAdjacency: z.number().int().min(0).max(5),
  /** How plausibly the KOL's audience contains the org's target users. */
  audienceOverlapPotential: z.number().int().min(0).max(5),
  /** Would this KOL mentioning the org feel natural to their audience? */
  naturalMentionFit: z.number().int().min(0).max(5),
  /** Unit 30: does what this KOL's engaged audience actually DOES/SEEKS match
   *  what the org's product needs users to do? Category ≠ intent (v26 rule 4):
   *  DEX traders ≠ lenders, mainstream gamers ≠ NFT traders, news readers ≠
   *  product users, forecasters DO have prediction-market intent. */
  audienceIntentOverlap: z.number().int().min(0).max(5).optional(),
  sharedTopics: z.array(z.string()).default([]),
  rationale: z.string(),
  relationship: KolRelationshipSchema.optional(),
  relationshipEvidence: z.string().optional(),
});
export type ContentFitAssessment = z.infer<typeof ContentFitAssessmentSchema>;

// Output of classifyAudienceAccounts.
export const AudienceClassificationSchema = z.object({
  accounts: z.array(AudienceAccountSchema).default([]),
  distribution: AudienceDistributionSchema,
});
export type AudienceClassification = z.infer<
  typeof AudienceClassificationSchema
>;

// The output of generateFitReport IS the fit report. Re-exported as a type only
// (no runtime import) to avoid a module cycle with report.ts, which imports the
// content-classification schema value from this file. The FitReportSchema value
// is available from report.ts / the package barrel.
export type { FitReport } from "./report.js";
