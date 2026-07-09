import type {
  AudienceClassification,
  KolContentClassification,
  OrgClassification,
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
};

// Provider-neutral ingestion evidence as plain booleans — the pipeline maps its
// SourceStatus to `status === "fetched"`, so scoring never imports the analysis
// ingestion types.
export type ScoringEvidence = {
  websiteFetched: boolean;
  docsFetched: boolean;
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
};

export type ScoringResult = {
  /** overall (=overall_fit) + the 8 other metrics in components + confidence. */
  scores: ScoreBreakdown;
  verdict: ReportVerdict;
};
