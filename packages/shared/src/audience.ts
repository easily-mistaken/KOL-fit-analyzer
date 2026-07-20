import { z } from "zod";

import { EngagementSourceSchema } from "./enums.js";
import {
  AudienceDomainSchema,
  AudienceQualitySchema,
  AudienceRegionSchema,
  AudienceRoleSchema,
} from "./vocab.js";

// A single engaged account after classification (Unit 43). Classified on three
// orthogonal axes — see vocab.ts for why they are separate. All three are
// REQUIRED: each has an explicit "unknown"/"real" value for the uncertain case,
// so an absent field would be indistinguishable from an unclassifiable account.
export const AudienceAccountSchema = z.object({
  handle: z.string().optional(),
  accountId: z.string().optional(),
  source: EngagementSourceSchema,
  /** What they do — independent of the space they do it in. */
  role: AudienceRoleSchema,
  /** What space they are in. "Not crypto" is no longer a category here; it is
   *  simply any domain that isn't one of the crypto ones. */
  domain: AudienceDomainSchema,
  /** Whether this is real engagement. Orthogonal on purpose: a farming account
   *  keeps its role and domain instead of collapsing into "airdrop_farmers". */
  quality: AudienceQualitySchema,
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

const bin = z.object({
  count: z.number().int().min(0),
  share: z.number().min(0).max(1),
});

// Distribution of the sampled engaged audience across all three axes (Unit 43).
// Matches the Report.audienceSummary JSON column. Each record is partial — only
// the values actually observed are present — and each axis's shares are over
// the SAME denominator (`sampleSize`), so the three views are directly
// comparable and none of them hides accounts in a filtered sub-total.
export const AudienceDistributionSchema = z.object({
  sampleSize: z.number().int().min(0),
  roles: z.partialRecord(AudienceRoleSchema, bin),
  domains: z.partialRecord(AudienceDomainSchema, bin),
  quality: z.partialRecord(AudienceQualitySchema, bin),
});
export type AudienceDistribution = z.infer<typeof AudienceDistributionSchema>;
