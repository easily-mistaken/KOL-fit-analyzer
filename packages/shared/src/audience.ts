import { z } from "zod";

import { EngagementSourceSchema } from "./enums.js";
import { AudienceBucketSchema, AudienceRegionSchema } from "./vocab.js";

// A single engaged account after classification. Aligns with the
// EngagedAccountSample DB model.
export const AudienceAccountSchema = z.object({
  handle: z.string().optional(),
  accountId: z.string().optional(),
  source: EngagementSourceSchema,
  bucket: AudienceBucketSchema,
  /** Coarse macro-region inferred from the profile location (Unit 41 Phase C).
   *  Absent/`unknown` when not placeable — never penalized, just uncounted. */
  region: AudienceRegionSchema.optional(),
  signals: z
    .object({
      botScore: z.number().min(0).max(1).optional(),
      emptyBio: z.boolean().optional(),
      farmingSignals: z.array(z.string()).default([]),
    })
    .partial(),
});
export type AudienceAccount = z.infer<typeof AudienceAccountSchema>;

// Per-region distribution of the engaged audience (Unit 41 Phase C). A DIAL —
// shown beside the fit score. `coverage` is the share of classified accounts we
// could actually place (X location is thin), so the UI can be honest about how
// much to trust it. `regions` shares are over PLACED accounts only.
export const RegionDistributionSchema = z.object({
  /** Classified accounts we could place into a known region. */
  placed: z.number().int().min(0),
  /** placed / total classified — how much of the audience we can locate. */
  coverage: z.number().min(0).max(1),
  regions: z.partialRecord(
    AudienceRegionSchema,
    z.object({
      count: z.number().int().min(0),
      share: z.number().min(0).max(1),
    })
  ),
});
export type RegionDistribution = z.infer<typeof RegionDistributionSchema>;

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
