import type {
  AudienceClassification,
  ContentFitAssessment,
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
  /** Engaged interactions (reply+quote+retweet) per TYPICAL original post —
   *  the volume input for expected reach (Unit 41 Phase B). A MEDIAN since
   *  Unit 51 (a viral outlier must not inflate the number a brand reads as
   *  typical); the name predates that and is kept for schema compatibility. */
  avgEngagedPerPost?: number;
  /** Share (0-1) of the fetched timeline that is reposts (native retweets) —
   *  drives the originality multiplier (Unit 48). Undefined = unknown, no
   *  penalty. */
  repostShare?: number;
  /** Days since the creator's last ORIGINAL (non-repost) post — drives the
   *  activity multiplier (Unit 48). Undefined = no timestamp data, no penalty. */
  daysSinceLastOriginalPost?: number;
  /** Original posts per week over the fetched timeline window — informational,
   *  surfaces in the overall reasons (Unit 48). */
  originalPostsPerWeek?: number;
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
};
