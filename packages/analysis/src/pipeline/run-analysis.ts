import {
  ANALYSIS_CAPS,
  FitReportSchema,
  type EngagedAccountRaw,
} from "@kol-fit/shared";
import { createLlmProvider, type ClassifyOrgInput } from "@kol-fit/llm";
import { scoreAnalysis } from "@kol-fit/scoring";
import { createTwitterProvider } from "@kol-fit/twitter";

import { ingestOrgContext } from "../ingestion/org-context.js";
import { collectEngagedAccounts } from "./collect-engagement.js";
import { selectTopPosts } from "./select-posts.js";
import type {
  AnalysisRequestData,
  AnalysisResult,
  PipelineEvidence,
  RunAnalysisOptions,
} from "./types.js";

function buildManualBrief(
  r: AnalysisRequestData
): ClassifyOrgInput["manualBrief"] {
  const brief: NonNullable<ClassifyOrgInput["manualBrief"]> = {};
  if (r.productCategory) brief.productCategory = r.productCategory;
  if (r.targetUser) brief.targetUser = r.targetUser;
  if (r.stage) brief.stage = r.stage;
  if (r.campaignGoal) brief.campaignGoal = r.campaignGoal;
  if (r.region) brief.region = r.region;
  return Object.keys(brief).length > 0 ? brief : undefined;
}

/**
 * The analysis pipeline: Twitter fetch -> optional website/docs ingestion ->
 * LLM classifications -> deterministic scoring (packages/scoring) -> fit report.
 * Depends only on provider interfaces/factories (never concrete providers) and
 * never touches @kol-fit/db. Returns a validated FitReport plus structured
 * evidence for the worker to persist.
 */
export async function runAnalysis(
  request: AnalysisRequestData,
  options: RunAnalysisOptions = {}
): Promise<AnalysisResult> {
  const twitter = options.twitter ?? createTwitterProvider();
  const llm = options.llm ?? createLlmProvider();
  const caps = options.caps ?? ANALYSIS_CAPS;
  const now = options.now ?? (() => new Date());
  const ingest = options.ingest ?? ingestOrgContext;
  const performWebIngestion = options.performWebIngestion ?? false;
  const twitterProviderKind =
    options.twitterProviderKind ?? process.env.TWITTER_PROVIDER ?? "mock";
  const llmProviderKind =
    options.llmProviderKind ?? process.env.LLM_PROVIDER ?? "mock";

  // 1. Website/docs ingestion (off by default -> both "skipped", no fetch).
  const ingestInput = performWebIngestion
    ? {
        websiteUrl: request.websiteUrl ?? undefined,
        docsUrl: request.docsUrl ?? undefined,
      }
    : {};
  const orgContext = await ingest(ingestInput, options.ingestOptions);

  // 2. Twitter fetch (mock).
  const [orgProfile, kolProfile] = await Promise.all([
    twitter.getUserProfile(request.orgHandle),
    twitter.getUserProfile(request.kolHandle),
  ]);
  const [kolPosts, kolReplies] = await Promise.all([
    twitter.getUserTweets(request.kolHandle, caps.kolPostsFetched),
    twitter.getUserReplies(request.kolHandle, caps.kolRepliesFetched),
  ]);

  const topPosts = selectTopPosts(kolPosts, caps.topPostsForDeepAnalysis);
  const groups: EngagedAccountRaw[][] = [];
  for (const post of topPosts) {
    const [replies, quotes, retweeters] = await Promise.all([
      twitter.getTweetReplies(post.id, caps.repliesPerPost),
      twitter.getTweetQuotes(post.id, caps.quotesPerPost),
      twitter.getTweetRetweeters(post.id, caps.retweetersPerPost),
    ]);
    groups.push(replies, quotes, retweeters);
  }
  const engagedAccounts = collectEngagedAccounts(
    groups,
    caps.maxUniqueEngagedAccounts
  );

  // 3. LLM classification (mock).
  const orgClassification = await llm.classifyOrgProfile({
    handle: request.orgHandle,
    profile: orgProfile,
    websiteText: orgContext.combinedText || undefined,
    manualBrief: buildManualBrief(request),
  });
  const kolContent = await llm.classifyKolContent({
    handle: request.kolHandle,
    profile: kolProfile,
    posts: kolPosts,
    replies: kolReplies,
  });
  const audience = await llm.classifyAudienceAccounts({
    accounts: engagedAccounts,
  });

  // 4. Deterministic scoring (packages/scoring). Numbers are computed here /
  // there — never by the LLM.
  const { scores, verdict } = scoreAnalysis({
    org: orgClassification,
    content: kolContent,
    audience,
    sample: {
      kolPostsSampled: kolPosts.length,
      kolRepliesSampled: kolReplies.length,
      topPostsAnalyzed: topPosts.length,
      engagedAccountsSampled: engagedAccounts.length,
    },
    evidence: {
      websiteFetched: orgContext.website.status === "fetched",
      docsFetched: orgContext.docs.status === "fetched",
    },
    brief: {
      campaignGoal: request.campaignGoal,
      region: request.region,
      productCategory: request.productCategory,
      targetUser: request.targetUser,
      stage: request.stage,
    },
  });

  // 5. Report synthesis (LLM builds the report; scores/verdict passed through).
  const baseReport = await llm.generateFitReport({
    org: { handle: request.orgHandle, classification: orgClassification },
    kol: { handle: request.kolHandle, content: kolContent },
    audience,
    scores,
    verdict,
    sampleSizes: {
      kolPosts: kolPosts.length,
      kolReplies: kolReplies.length,
      topPostsAnalyzed: topPosts.length,
      engagedAccounts: engagedAccounts.length,
      // The LLM-classified count may be < total when a provider caps audience
      // classification (Unit 17 OpenAI cap); record both so confidence can
      // reflect the capped sample later.
      engagedAccountsClassified: audience.distribution.sampleSize,
    },
  });

  // Annotate evidence (sample sizes + provider/ingestion notes) and re-validate
  // the final report before it leaves the pipeline (Invariant 12).
  const report = FitReportSchema.parse({
    ...baseReport,
    evidence: {
      sampleSizes: {
        ...baseReport.evidence.sampleSizes,
        websiteChars: orgContext.website.charCount,
        docsChars: orgContext.docs.charCount,
      },
      notes: [
        ...baseReport.evidence.notes,
        "Scores computed by deterministic scoring (engaged-audience-match weighted).",
        `Providers: twitter=${twitterProviderKind}, llm=${llmProviderKind} (model ${llm.model}).`,
        `Website ingestion: ${orgContext.website.status}; docs ingestion: ${orgContext.docs.status}.`,
      ],
    },
  });

  const evidence: PipelineEvidence = {
    orgHandle: request.orgHandle,
    kolHandle: request.kolHandle,
    kolPostsSampled: kolPosts.length,
    kolRepliesSampled: kolReplies.length,
    topPostsAnalyzed: topPosts.length,
    engagedAccountsSampled: engagedAccounts.length,
    audienceDistribution: audience.distribution,
    websiteStatus: orgContext.website.status,
    docsStatus: orgContext.docs.status,
    twitterProviderKind,
    llmProviderKind,
    llmModel: llm.model,
    confidence: report.confidence,
  };

  return {
    report,
    scores,
    evidence,
    llmModel: llm.model,
    generatedAt: now().toISOString(),
  };
}
