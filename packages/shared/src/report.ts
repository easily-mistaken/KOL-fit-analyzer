import { z } from "zod";

import { REPORT_SCHEMA_VERSION } from "./constants.js";
import { AudienceDistributionSchema } from "./audience.js";
import { ReportVerdictSchema } from "./enums.js";
import { KolContentClassificationSchema } from "./llm.js";
import { ConfidenceLevelSchema, ScoreValueSchema } from "./scores.js";

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
