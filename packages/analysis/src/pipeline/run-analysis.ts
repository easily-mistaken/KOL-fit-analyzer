import {
  ANALYSIS_CAPS,
  FitReportSchema,
  foldDomainSegments,
  type AnalysisProgress,
  type AnalysisStage,
  type AudienceDistribution,
  type AudienceGlimpse,
  type EngagedAccountRaw,
  type ProfileGlimpse,
  type TwitterUser,
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

// Bounded-concurrency engagement fetching (Unit 29D): posts in flight at once.
// Each post still fires its 3 engagement calls in parallel.
const DEFAULT_ENGAGEMENT_FETCH_CONCURRENCY = 6;

function envConcurrency(): number | undefined {
  const n = Number(process.env.ANALYSIS_ENGAGEMENT_FETCH_CONCURRENCY);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
}

/** Bounded-concurrency map; results are input-ordered (determinism). */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker)
  );
  return results;
}

const PROGRESS_STAGE_INDEX: Record<AnalysisStage, number> = {
  reading: 0,
  measuring: 1,
  quality: 2,
  report: 3,
};

/** Report-safe public glimpse of a fetched profile (no internal fields). */
function toGlimpse(handle: string, u: TwitterUser | null): ProfileGlimpse {
  return u
    ? {
        handle: u.handle,
        displayName: u.displayName ?? null,
        avatarUrl: u.avatarUrl ?? null,
        followersCount: u.followersCount ?? null,
        verified: u.verified ?? null,
      }
    : { handle };
}

/**
 * Top folded audience segments for the "audience taking shape" teaser. Reuses
 * the same fold as the report donut (largest-first), capped small — shares are
 * already client-visible in the finished report, so this leaks nothing.
 *
 * Shows the DOMAIN axis: "what is this audience about" is the question a
 * watching user is actually asking, and it is the one axis that reads without
 * any context about the brand. Junk engagement no longer has a slice to sort
 * last (quality is its own axis now), so it is appended explicitly — dropping
 * it would hide the highest-signal number in a "who actually listens" product.
 */
function topAudienceGlimpse(
  distribution: AudienceDistribution,
  max = 4
): AudienceGlimpse[] {
  const junk = (["bot", "farmer", "giveaway_hunter"] as const).reduce(
    (sum, q) => sum + (distribution.quality[q]?.share ?? 0),
    0
  );
  const room = junk > 0 ? Math.max(1, max - 1) : max;
  const out: AudienceGlimpse[] = foldDomainSegments(distribution, room).map(
    (s) => ({ label: s.label, share: s.share, low: false })
  );
  if (junk > 0) out.push({ label: "Low-quality", share: junk, low: true });
  return out;
}

/**
 * The analysis pipeline: Twitter fetch -> optional website/docs ingestion ->
 * LLM classifications -> deterministic scoring (packages/scoring) -> fit report.
 * Depends only on provider interfaces/factories (never concrete providers) and
 * never touches @kol-fit/db. Returns a validated FitReport plus structured
 * evidence for the worker to persist. Independent stages run concurrently
 * (Unit 29D) with deterministic, input-ordered results.
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
  const engagementConcurrency =
    options.engagementConcurrency ??
    envConcurrency() ??
    DEFAULT_ENGAGEMENT_FETCH_CONCURRENCY;
  const twitterProviderKind =
    options.twitterProviderKind ?? process.env.TWITTER_PROVIDER ?? "mock";
  const llmProviderKind =
    options.llmProviderKind ?? process.env.LLM_PROVIDER ?? "mock";

  // Fire-and-forget progress emit. Never awaited, never throws — a slow or
  // failing sink can never affect the analysis result.
  const emitProgress = (
    stage: AnalysisStage,
    extra?: Pick<AnalysisProgress, "org" | "kol" | "audience">
  ): void => {
    if (!options.onProgress) return;
    try {
      options.onProgress({
        stage,
        stageIndex: PROGRESS_STAGE_INDEX[stage],
        updatedAt: now().toISOString(),
        ...extra,
      });
    } catch {
      /* swallow: progress is best-effort */
    }
  };

  // 1. Website/docs ingestion (off by default -> both "skipped", no fetch).
  // Started here, awaited only where its result is needed (org classification)
  // so it overlaps the Twitter fetch (Unit 29D).
  const ingestInput = performWebIngestion
    ? {
        websiteUrl: request.websiteUrl ?? undefined,
        docsUrl: request.docsUrl ?? undefined,
      }
    : {};
  const ingestPromise = ingest(ingestInput, options.ingestOptions);

  // 2. Twitter fetch — profiles/posts/replies are independent, one round-trip.
  const [orgProfile, kolProfile, kolPosts, kolReplies] = await Promise.all([
    twitter.getUserProfile(request.orgHandle),
    twitter.getUserProfile(request.kolHandle),
    twitter.getUserTweets(request.kolHandle, caps.kolPostsFetched),
    twitter.getUserReplies(request.kolHandle, caps.kolRepliesFetched),
  ]);

  // Guard (2026-07-14 live-calibration finding): a provider soft-failure (e.g.
  // exhausted API credits returning success envelopes with no data) must fail
  // the analysis loudly — zero fetched posts would otherwise flow through and
  // produce a confident-looking garbage verdict.
  if (kolPosts.length === 0) {
    throw new Error(
      `No posts could be fetched for @${request.kolHandle} — the KOL is unanalyzable (empty or unavailable Twitter data).`
    );
  }

  // Guard (Unit 41 live-verification finding): an empty/failed ORG profile fetch
  // (null after normalization — e.g. a renamed/suspended handle) with no manual
  // brief leaves the brand unclassifiable. Org classification would then fall
  // back to a generic "any crypto" target and, under v3 (where the fit IS the
  // audience match), surface a confident STRONG from nothing. Fail loudly,
  // mirroring the empty-KOL-posts guard. (With a manual brief the brief defines
  // the target, so the run can still proceed.)
  if (orgProfile === null && buildManualBrief(request) === undefined) {
    throw new Error(
      `No profile could be fetched for the brand @${request.orgHandle} and no manual brief was provided — the brand can't be classified, so a meaningful audience match can't be computed. Check the handle or add product/target context.`
    );
  }

  // Stage 0 "reading" done: profiles are in hand. Advance to "measuring" (the
  // slow engagement pass) and hand the UI the real, public who-they-are facts.
  emitProgress("measuring", {
    org: toGlimpse(request.orgHandle, orgProfile),
    kol: toGlimpse(request.kolHandle, kolProfile),
  });

  const topPosts = selectTopPosts(kolPosts, caps.topPostsForDeepAnalysis);
  // Per-post engagement with bounded concurrency (Unit 29D). Index-ordered
  // results keep the group order identical to the sequential version, so
  // dedupe/appearances/output stay byte-identical.
  const perPost = await mapConcurrent(
    topPosts,
    engagementConcurrency,
    async (post) => {
      const [replies, quotes, retweeters] = await Promise.all([
        twitter.getTweetReplies(post.id, caps.repliesPerPost),
        twitter.getTweetQuotes(post.id, caps.quotesPerPost),
        twitter.getTweetRetweeters(post.id, caps.retweetersPerPost),
      ]);
      return [replies, quotes, retweeters];
    }
  );
  const groups: EngagedAccountRaw[][] = perPost.flat();
  const engagedAccounts = collectEngagedAccounts(
    groups,
    caps.maxUniqueEngagedAccounts
  );

  // Stage 1 "measuring" done: the engaged crowd is collected. Advance to
  // "quality" (classifying who they actually are).
  emitProgress("quality");

  const orgContext = await ingestPromise;

  // 3. LLM classification — org and KOL content are independent (Unit 29D).
  const [orgClassification, kolContent] = await Promise.all([
    llm.classifyOrgProfile({
      handle: request.orgHandle,
      profile: orgProfile,
      websiteText: orgContext.combinedText || undefined,
      manualBrief: buildManualBrief(request),
    }),
    llm.classifyKolContent({
      handle: request.kolHandle,
      profile: kolProfile,
      posts: kolPosts,
      replies: kolReplies,
    }),
  ]);
  // Audience classification and the pair-specific content-fit rubric (29B) are
  // independent — run them in parallel. A rubric failure degrades scoring to
  // its token-overlap fallback instead of failing the analysis (Invariant 8).
  const [audience, contentFitAssessment] = await Promise.all([
    llm.classifyAudienceAccounts({ accounts: engagedAccounts }),
    llm
      .assessContentFit({
        org: { handle: request.orgHandle, classification: orgClassification },
        kol: {
          handle: request.kolHandle,
          content: kolContent,
          profile: kolProfile,
        },
      })
      .catch(() => undefined),
  ]);

  // Audience is classified: reveal the first read of who actually engages
  // (folded shares — already client-visible in the report). Stays on "quality"
  // while scoring runs.
  emitProgress("quality", { audience: topAudienceGlimpse(audience.distribution) });

  // Repeat-engager share from 29A `appearances` (accounts engaging >=2
  // analyzed posts) — feeds the audience-quality community bonus.
  const repeatEngagerShare =
    engagedAccounts.length > 0
      ? engagedAccounts.filter((a) => (a.appearances ?? 1) >= 2).length /
        engagedAccounts.length
      : 0;

  // Typical engaged interactions (reply+quote+retweet) per fetched post — the
  // volume input for expected reach (Unit 41 Phase B). Mean over all fetched
  // posts (a representative "typical post", not the engagement-selected top
  // posts). Likes/impressions are deliberately excluded (vanity metrics).
  const engagementCounts = kolPosts.map(
    (t) => (t.replyCount ?? 0) + (t.quoteCount ?? 0) + (t.retweetCount ?? 0)
  );
  const avgEngagedPerPost =
    engagementCounts.length > 0
      ? engagementCounts.reduce((a, b) => a + b, 0) / engagementCounts.length
      : 0;

  // 4. Deterministic scoring (packages/scoring). Numbers are computed here /
  // there — never by the LLM.
  const { scores, verdict, expectedReach, audienceRegions } = scoreAnalysis({
    org: orgClassification,
    content: kolContent,
    audience,
    contentFitAssessment,
    kolPostLangs: kolPosts
      .map((t) => t.lang)
      .filter((l): l is string => Boolean(l)),
    sample: {
      kolPostsSampled: kolPosts.length,
      kolRepliesSampled: kolReplies.length,
      topPostsAnalyzed: topPosts.length,
      engagedAccountsSampled: engagedAccounts.length,
      engagedAccountsClassified: audience.distribution.sampleSize,
      repeatEngagerShare,
      avgEngagedPerPost,
    },
    evidence: {
      websiteFetched: orgContext.website.status === "fetched",
      docsFetched: orgContext.docs.status === "fetched",
      hasEngagementText: engagedAccounts.some((a) => Boolean(a.text)),
    },
    brief: {
      campaignGoal: request.campaignGoal,
      region: request.region,
      productCategory: request.productCategory,
      targetUser: request.targetUser,
      stage: request.stage,
    },
  });

  // Stage 2 "quality" done (scores computed). Advance to "report" synthesis.
  emitProgress("report");

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

  // Compact profile snapshots for presentation (avatar/name/followers).
  const snapshot = (u: typeof orgProfile) =>
    u
      ? {
          handle: u.handle,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          followersCount: u.followersCount,
          verified: u.verified,
        }
      : null;

  // Annotate evidence (sample sizes + provider/ingestion notes) and re-validate
  // the final report before it leaves the pipeline (Invariant 12).
  const report = FitReportSchema.parse({
    ...baseReport,
    profiles: { org: snapshot(orgProfile), kol: snapshot(kolProfile) },
    expectedReach,
    audienceRegions,
    targeting: {
      primaryRoles: orgClassification.targetRoles?.primary ?? [],
      secondaryRoles: orgClassification.targetRoles?.secondary ?? [],
      primaryDomains: orgClassification.targetDomains?.primary ?? [],
      secondaryDomains: orgClassification.targetDomains?.secondary ?? [],
      valuedRegions: orgClassification.valuedRegions ?? [],
    },
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
