import {
  AudienceBucketSchema,
  ConfidenceLevelSchema,
  EngagementSourceSchema,
} from "@kol-fit/shared";

// Hand-authored strict JSON Schemas for OpenAI Structured Outputs. Strict mode
// requires every property in `required` and additionalProperties:false;
// optionals are expressed as nullable. Enum values are pulled from the shared
// Zod schemas so they never drift. These are model-facing shapes ONLY — the
// shared Zod schema remains the trust boundary for the returned data.

const nullableString = { type: ["string", "null"] } as const;
const stringArray = { type: "array", items: { type: "string" } } as const;

const BUCKETS = [...AudienceBucketSchema.options];
const SOURCES = [...EngagementSourceSchema.options];
const CONFIDENCE = [...ConfidenceLevelSchema.options];

export const ORG_CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    productCategory: nullableString,
    targetUser: nullableString,
    stage: nullableString,
    campaignGoal: nullableString,
    region: nullableString,
    keywords: stringArray,
    confidence: { type: "string", enum: CONFIDENCE },
  },
  required: [
    "productCategory",
    "targetUser",
    "stage",
    "campaignGoal",
    "region",
    "keywords",
    "confidence",
  ],
} as const;

export const KOL_CONTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    themes: stringArray,
    verticals: stringArray,
    style: nullableString,
    depth: nullableString,
    promoPatterns: stringArray,
    repeatedTickers: stringArray,
  },
  required: ["themes", "verticals", "style", "depth", "promoPatterns", "repeatedTickers"],
} as const;

// The model labels each account; it does NOT emit counts/percentages.
export const AUDIENCE_BATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    accounts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          accountId: nullableString,
          handle: nullableString,
          source: { type: "string", enum: SOURCES },
          bucket: { type: "string", enum: BUCKETS },
          signals: {
            type: "object",
            additionalProperties: false,
            properties: {
              // No minimum/maximum: OpenAI strict Structured Outputs rejects
              // numeric constraints. The shared Zod schema enforces botScore
              // ∈ [0,1] (and the provider clamps) as the trust boundary.
              botScore: { type: ["number", "null"] },
              emptyBio: { type: ["boolean", "null"] },
              farmingSignals: stringArray,
            },
            required: ["botScore", "emptyBio", "farmingSignals"],
          },
        },
        required: ["accountId", "handle", "source", "bucket", "signals"],
      },
    },
  },
  required: ["accounts"],
} as const;

// Narrative ONLY — no numeric/score/verdict fields. The provider injects the
// deterministic scores/verdict; the model can never produce them.
export const REPORT_NARRATIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    keyTakeaways: stringArray,
    bestUseCases: stringArray,
    weakUseCases: stringArray,
    audienceMatchSummary: { type: "string" },
    contentNarrative: { type: "string" },
    engagementNarrative: { type: "string" },
    engagementSignals: stringArray,
    paidPromoNarrative: { type: "string" },
    botFarmNarrative: { type: "string" },
    brandSafetyNarrative: { type: "string" },
    geoNarrative: { type: "string" },
    recommendedAngle: { type: "string" },
    evidenceNotes: stringArray,
  },
  required: [
    "summary",
    "keyTakeaways",
    "bestUseCases",
    "weakUseCases",
    "audienceMatchSummary",
    "contentNarrative",
    "engagementNarrative",
    "engagementSignals",
    "paidPromoNarrative",
    "botFarmNarrative",
    "brandSafetyNarrative",
    "geoNarrative",
    "recommendedAngle",
    "evidenceNotes",
  ],
} as const;
