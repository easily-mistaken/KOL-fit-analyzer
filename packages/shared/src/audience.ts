import { z } from "zod";

import { EngagementSourceSchema } from "./enums.js";
import { AudienceBucketSchema } from "./vocab.js";

// A single engaged account after classification. Aligns with the
// EngagedAccountSample DB model.
export const AudienceAccountSchema = z.object({
  handle: z.string().optional(),
  accountId: z.string().optional(),
  source: EngagementSourceSchema,
  bucket: AudienceBucketSchema,
  signals: z
    .object({
      botScore: z.number().min(0).max(1).optional(),
      emptyBio: z.boolean().optional(),
      farmingSignals: z.array(z.string()).default([]),
    })
    .partial(),
});
export type AudienceAccount = z.infer<typeof AudienceAccountSchema>;

// Per-bucket distribution of the sampled engaged audience. Matches the
// Report.audienceSummary JSON column. Buckets is a partial record — only the
// buckets actually observed are present.
export const AudienceDistributionSchema = z.object({
  sampleSize: z.number().int().min(0),
  buckets: z.partialRecord(
    AudienceBucketSchema,
    z.object({
      count: z.number().int().min(0),
      share: z.number().min(0).max(1),
    })
  ),
});
export type AudienceDistribution = z.infer<typeof AudienceDistributionSchema>;
