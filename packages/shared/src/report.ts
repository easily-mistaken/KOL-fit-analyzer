import { z } from "zod";

import { REPORT_SCHEMA_VERSION } from "./constants.js";
import {
  AudienceDistributionSchema,
  DomainDistributionSchema,
  RegionDistributionSchema,
} from "./audience.js";
import { AudienceBucketSchema, AudienceRegionSchema } from "./vocab.js";
import { ReportVerdictSchema } from "./enums.js";
import { KolContentClassificationSchema } from "./llm.js";
import {
  ConfidenceLevelSchema,
  ExpectedReachSchema,
  ScoreValueSchema,
} from "./scores.js";

// Compact org/KOL profile snapshot for report presentation (avatar, name,
// follower count). Populated by the pipeline from the fetched Twitter profile.
export const ProfileSnapshotSchema = z.object({
  handle: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  followersCount: z.number().int().min(0).optional(),
  verified: z.boolean().optional(),
});
export type ProfileSnapshot = z.infer<typeof ProfileSnapshotSchema>;

// The 15-section fit report. This is the structured LLM output validated before
// saving (Report.report JSON) and rendered by Unit 15.
//
// The required spine — schemaVersion, overallScore, verdict, evidence,
// confidence — is always present so the verdict is understandable at a glance.
// Narrative sections are optional so a missing section degrades gracefully
// rather than failing validation (Unit 15 requirement).
export const FitReportSchema = z.object({
  // spine
  schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
  overallScore: ScoreValueSchema, // 1. Overall Fit Score
  verdict: ReportVerdictSchema, // 2. Final Verdict
  confidence: ConfidenceLevelSchema, // 15. Confidence Level
  evidence: z.object({
    // 14. Evidence and Sample Size (matches ReportEvidence)
    sampleSizes: z.record(z.string(), z.number().int().min(0)).default({}),
    notes: z.array(z.string()).default([]),
  }),

  // Executive summary — a short readable prose conclusion (3-5 sentences) that
  // ties the metrics together into a takeaway a reader can skim. Optional so
  // older reports (and any provider that omits it) still validate.
  summary: z.string().optional(),

  // Key takeaways — the summary as 3-5 punchy one-line points for fast scanning.
  // Optional/additive; the UI falls back to sentence-splitting `summary`.
  keyTakeaways: z.array(z.string()).default([]),

  // Org/KOL profile snapshots (avatar/name/followers) for presentation.
  // Optional/additive so older reports still validate.
  profiles: z
    .object({
      org: ProfileSnapshotSchema.nullable(),
      kol: ProfileSnapshotSchema.nullable(),
    })
    .optional(),

  // Expected reach dial (Unit 41 v3, Phase B) — deterministic, injected by the
  // pipeline (not the LLM). Optional/additive so older reports still validate.
  expectedReach: ExpectedReachSchema.optional(),

  // Audience geography dial (Unit 41 v3, Phase C) — deterministic region
  // breakdown of the engaged audience, injected by the pipeline. Optional.
  audienceRegions: RegionDistributionSchema.optional(),

  // What the OUTSIDE-CRYPTO slice is actually made of — deterministic, injected
  // by the pipeline. Exists because "42% non-crypto" is a black hole for any
  // brand that isn't itself crypto. Optional: absent on pre-v4 reports and on
  // audiences with no outside-crypto accounts.
  audienceDomains: DomainDistributionSchema.optional(),

  // Whether the brand's own product is crypto-native, carried onto the report
  // so the client can pick the audience layout without re-deriving it from the
  // org classification. Absent = treat as crypto-native (historical default).
  brandCryptoNative: z.boolean().optional(),

  // What the fit score was matched against (Unit 41 v3, Phase D) — the inferred
  // target audience + economically-valued regions, surfaced so the brand can
  // SEE (and sanity-check) what the score rests on. Injected by the pipeline.
  targeting: z
    .object({
      primaryBuckets: z.array(AudienceBucketSchema).default([]),
      secondaryBuckets: z.array(AudienceBucketSchema).default([]),
      valuedRegions: z.array(AudienceRegionSchema).default([]),
    })
    .optional(),

  // narrative sections (optional -> degrade gracefully)
  bestUseCases: z.array(z.string()).default([]), // 3. Best Use Cases
  weakUseCases: z.array(z.string()).default([]), // 4. Weak Use Cases
  audienceMatch: z
    .object({ summary: z.string(), score: ScoreValueSchema })
    .optional(), // 5. Audience Match
  audienceBreakdown: AudienceDistributionSchema.optional(), // 6. Audience Breakdown
  contentAnalysis: z
    .object({
      classification: KolContentClassificationSchema,
      narrative: z.string(),
    })
    .optional(), // 7. KOL Content Analysis
  engagementQuality: z
    .object({ narrative: z.string(), signals: z.array(z.string()).default([]) })
    .optional(), // 8. Engagement Quality
  paidPromo: z
    .object({ narrative: z.string(), riskScore: ScoreValueSchema })
    .optional(), // 9. Paid Promo Detection
  botFarmRisk: z
    .object({ narrative: z.string(), riskScore: ScoreValueSchema })
    .optional(), // 10. Bot/Farm Risk
  brandSafety: z
    .object({ narrative: z.string(), score: ScoreValueSchema })
    .optional(), // 11. Brand Safety
  geoLanguageFit: z
    .object({ narrative: z.string(), score: ScoreValueSchema })
    .optional(), // 12. Geo/Language Fit
  recommendedAngle: z.string().optional(), // 13. Recommended Campaign Angle
});
export type FitReport = z.infer<typeof FitReportSchema>;
