import type {
  AnalysisCaps,
  AudienceDistribution,
  ConfidenceLevel,
  FitReport,
  ScoreBreakdown,
} from "@kol-fit/shared";
import type { LlmProvider } from "@kol-fit/llm";
import type { TwitterProvider } from "@kol-fit/twitter";

import type { ingestOrgContext } from "../ingestion/org-context.js";
import type { IngestOptions, SourceStatus } from "../ingestion/types.js";

// Prisma-free view of an AnalysisRequest — the worker maps its DB row to this,
// keeping the pipeline decoupled from @kol-fit/db.
export type AnalysisRequestData = {
  orgHandle: string;
  kolHandle: string;
  websiteUrl?: string | null;
  docsUrl?: string | null;
  // manual brief (overrides inferred org fields — Invariant 7)
  productCategory?: string | null;
  targetUser?: string | null;
  campaignGoal?: string | null;
  stage?: string | null;
  region?: string | null;
};

export type RunAnalysisOptions = {
  /** Twitter provider (default: createTwitterProvider() — mock via env). */
  twitter?: TwitterProvider;
  /** LLM provider (default: createLlmProvider() — mock via env). */
  llm?: LlmProvider;
  /** Analysis caps (default: ANALYSIS_CAPS). */
  caps?: AnalysisCaps;
  /** Perform live website/docs ingestion. Default false (no live calls in Unit 13). */
  performWebIngestion?: boolean;
  /** Injectable ingestion fn (tests); default the real module fn. */
  ingest?: typeof ingestOrgContext;
  /** Injectable fetchImpl/now for offline ingestion. */
  ingestOptions?: IngestOptions;
  /** Injectable clock (default () => new Date()). */
  now?: () => Date;
  /** How many top posts fetch their engagement concurrently (Unit 29D).
   *  Default 6; env override ANALYSIS_ENGAGEMENT_FETCH_CONCURRENCY. */
  engagementConcurrency?: number;
  /** Evidence label; default process.env.TWITTER_PROVIDER ?? "mock". */
  twitterProviderKind?: string;
  /** Evidence label; default process.env.LLM_PROVIDER ?? "mock". */
  llmProviderKind?: string;
};

export type PipelineEvidence = {
  orgHandle: string;
  kolHandle: string;
  kolPostsSampled: number;
  kolRepliesSampled: number;
  topPostsAnalyzed: number;
  engagedAccountsSampled: number;
  audienceDistribution: AudienceDistribution;
  websiteStatus: SourceStatus;
  docsStatus: SourceStatus;
  twitterProviderKind: string;
  llmProviderKind: string;
  llmModel: string;
  confidence: ConfidenceLevel;
};

export type AnalysisResult = {
  /** Validated against FitReportSchema before it leaves the pipeline. */
  report: FitReport;
  /** Deterministic score breakdown from packages/scoring. */
  scores: ScoreBreakdown;
  evidence: PipelineEvidence;
  llmModel: string;
  generatedAt: string;
};
