import { z } from "zod";

import { AudienceAccountSchema, AudienceDistributionSchema } from "./audience.js";
import { ConfidenceLevelSchema } from "./scores.js";

// Provider-neutral LLM structured outputs. These are the shapes an LLM provider
// (mock in Unit 11, OpenAI in Unit 17) must return; they must pass Zod
// validation before use or persistence (Invariants 3, 9, 12). Reuse the shared
// schemas rather than re-deriving.

// Output of classifyOrgProfile. Manual brief fields on the request override
// these inferred fields (Invariant 7).
export const OrgClassificationSchema = z.object({
  productCategory: z.string().optional(),
  targetUser: z.string().optional(),
  stage: z.string().optional(),
  campaignGoal: z.string().optional(),
  region: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  confidence: ConfidenceLevelSchema,
});
export type OrgClassification = z.infer<typeof OrgClassificationSchema>;

// Output of classifyKolContent.
export const KolContentClassificationSchema = z.object({
  themes: z.array(z.string()).default([]),
  verticals: z.array(z.string()).default([]),
  style: z.string().optional(),
  depth: z.string().optional(),
  promoPatterns: z.array(z.string()).default([]),
  repeatedTickers: z.array(z.string()).default([]),
});
export type KolContentClassification = z.infer<
  typeof KolContentClassificationSchema
>;

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
