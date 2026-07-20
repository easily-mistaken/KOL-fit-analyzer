import {
  AudienceBucketSchema,
  AudienceDomainSchema,
  AudienceRegionSchema,
  BrandSafetyFlagKindSchema,
  ConfidenceLevelSchema,
  EngagementSourceSchema,
  MediaLabelSchema,
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
const SAFETY_FLAGS = [...BrandSafetyFlagKindSchema.options];
const MEDIA_KINDS = [...MediaLabelSchema.shape.kind.options];
const REGIONS = [...AudienceRegionSchema.options];
const DOMAINS = [...AudienceDomainSchema.options];

const bucketArray = {
  type: "array",
  items: { type: "string", enum: BUCKETS },
} as const;

const regionArray = {
  type: "array",
  items: { type: "string", enum: REGIONS },
} as const;

// Nullable region enum for per-account labeling (unplaceable -> null/unknown).
const nullableRegion = { type: ["string", "null"], enum: [...REGIONS, null] } as const;

// Nullable domain enum — carried ONLY for `non_crypto` accounts, null for every
// other bucket (which already says what the account is).
const nullableDomain = { type: ["string", "null"], enum: [...DOMAINS, null] } as const;

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
    // The org's wanted audience buckets (Unit 29B) — drives scoring v2's
    // engaged-audience match instead of regex keyword derivation.
    targetBuckets: {
      type: "object",
      additionalProperties: false,
      properties: { primary: bucketArray, secondary: bucketArray },
      required: ["primary", "secondary"],
    },
    // Macro-regions where the product is economically relevant (Unit 41 Phase
    // C2). Empty when the product has no regional preference.
    valuedRegions: regionArray,
    // Is the BRAND's own product crypto-native (Unit 42)? Presentation only —
    // decides whether the audience reads as one "Outside crypto" number or as a
    // domain breakdown with the crypto buckets folded away.
    cryptoNative: { type: "boolean" },
    confidence: { type: "string", enum: CONFIDENCE },
  },
  required: [
    "productCategory",
    "targetUser",
    "stage",
    "campaignGoal",
    "region",
    "keywords",
    "targetBuckets",
    "valuedRegions",
    "cryptoNative",
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
    // Unit 29B: per-post promo labels (saturation computed in scoring, not here).
    postLabels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          postId: { type: "string" },
          isPromo: { type: "boolean" },
          promoRelated: { type: ["boolean", "null"] },
          promoQuality: { type: ["string", "null"], enum: ["low", "ok", null] },
        },
        required: ["postId", "isPromo", "promoRelated", "promoQuality"],
      },
    },
    // Unit 29B: explicit brand-safety flags with severity + post evidence.
    brandSafetyFlags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          flag: { type: "string", enum: SAFETY_FLAGS },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          evidence: { type: "string" },
        },
        required: ["flag", "severity", "evidence"],
      },
    },
    // Unit 29B: one label per ATTACHED image (aggregation happens downstream).
    mediaLabels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          postId: { type: "string" },
          kind: { type: "string", enum: MEDIA_KINDS },
        },
        required: ["postId", "kind"],
      },
    },
  },
  required: [
    "themes",
    "verticals",
    "style",
    "depth",
    "promoPatterns",
    "repeatedTickers",
    "postLabels",
    "brandSafetyFlags",
    "mediaLabels",
  ],
} as const;

// Pair-specific content-fit rubric — bounded ordinal ratings only (the shared
// Zod schema enforces integer 0-5; strict mode can't express min/max). The
// Unit 29F relationship + Unit 30 intent fields were removed in Unit 41 (v3
// scoring is audience-only).
export const CONTENT_FIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    topicalAdjacency: { type: "integer" },
    audienceOverlapPotential: { type: "integer" },
    naturalMentionFit: { type: "integer" },
    sharedTopics: stringArray,
    rationale: { type: "string" },
  },
  required: [
    "topicalAdjacency",
    "audienceOverlapPotential",
    "naturalMentionFit",
    "sharedTopics",
    "rationale",
  ],
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
          // Coarse macro-region inferred from location/language/bio (Unit 41
          // Phase C2). null when not placeable.
          region: nullableRegion,
          // What the account is ABOUT — only for bucket=non_crypto (Unit 42).
          domain: nullableDomain,
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
        required: [
          "accountId",
          "handle",
          "source",
          "bucket",
          "region",
          "domain",
          "signals",
        ],
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
