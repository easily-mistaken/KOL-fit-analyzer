import type {
  AudienceClassification,
  ContentFitAssessment,
  DomainDistribution,
  ExpectedReach,
  KolContentClassification,
  OrgClassification,
  RegionDistribution,
  ReportVerdict,
  ScoreBreakdown,
} from "@kol-fit/shared";

// Scoring input types are defined HERE (not imported from packages/analysis), so
// packages/scoring stays independent — the dependency direction is
// analysis -> scoring only. Composed from shared provider-neutral value types.

export type ScoringSampleMeta = {
  kolPostsSampled: number;
  kolRepliesSampled: number;
  topPostsAnalyzed: number;
  engagedAccountsSampled: number;
  /** LLM-classified count (may be < sampled under the classification cap).
   *  Confidence keys off this when present (Unit 29C). */
  engagedAccountsClassified?: number;
  /** Share of unique engaged accounts that engaged >=2 analyzed posts
   *  (from 29A `appearances`; computed by the pipeline). */
  repeatEngagerShare?: number;
  /** Mean engaged interactions (reply+quote+retweet) per fetched post — the
   *  volume input for expected reach (Unit 41 Phase B). Computed by the
   *  pipeline from the fetched tweet engagement counts. */
  avgEngagedPerPost?: number;
};

// Provider-neutral ingestion evidence as plain booleans — the pipeline maps its
// SourceStatus to `status === "fetched"`, so scoring never imports the analysis
// ingestion types.
export type ScoringEvidence = {
  websiteFetched: boolean;
  docsFetched: boolean;
  /** True when reply/quote text was available for audience classification
   *  (29A enrichment) — raises confidence (Unit 29C). */
  hasEngagementText?: boolean;
};

export type ScoringBrief = {
  campaignGoal?: string | null;
  region?: string | null;
  productCategory?: string | null;
  targetUser?: string | null;
  stage?: string | null;
};

export type ScoringInput = {
  org: OrgClassification;
  content: KolContentClassification;
  audience: AudienceClassification;
  sample: ScoringSampleMeta;
  evidence: ScoringEvidence;
  brief: ScoringBrief;
  /** 29B semantic content-fit rubric; absent -> token-overlap fallback. */
  contentFitAssessment?: ContentFitAssessment;
  /** `Tweet.lang` values of the sampled KOL posts (geo/language v2). */
  kolPostLangs?: string[];
};

export type ScoringResult = {
  /** overall (=overall_fit) + the 8 other metrics in components + confidence. */
  scores: ScoreBreakdown;
  verdict: ReportVerdict;
  /** Expected reach dial (Phase B) — shown beside the fit score, never in it. */
  expectedReach: ExpectedReach;
  /** Audience geography dial (Phase C) — region breakdown of engaged accounts. */
  audienceRegions: RegionDistribution;
  /** What the outside-crypto slice is made of (Unit 42). Descriptive only —
   *  no metric reads it; it exists so that slice isn't a black hole. */
  audienceDomains: DomainDistribution;
};
