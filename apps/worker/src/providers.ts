import {
  PrismaCacheStore,
  resolveCacheConfig,
  resolveClassificationCacheConfig,
  withLlmCache,
  withTwitterCache,
  type CachingLlmProvider,
  type CachingTwitterProvider,
} from "@kol-fit/cache";
import { Prisma, prisma } from "@kol-fit/db";
import { createLlmProvider } from "@kol-fit/llm";
import {
  createTwitterProvider,
  type TwitterProvider,
} from "@kol-fit/twitter";

/**
 * Builds the providers for one analysis run: the live/mock Twitter provider
 * wrapped with the DB-backed cache (Unit 19), and the LLM provider. Caching and
 * usage logging live worker-side so the pipeline (@kol-fit/analysis) stays pure
 * and db-free (architecture invariant).
 */
export function buildProviders(): {
  twitter: CachingTwitterProvider;
  llm: CachingLlmProvider;
} {
  const twitterKind = process.env.TWITTER_PROVIDER ?? "mock";
  const twitter = withTwitterCache(
    createTwitterProvider(),
    new PrismaCacheStore(twitterKind),
    resolveCacheConfig()
  );
  // Content-addressed reuse of the expensive classifications across analyses
  // (Unit 23). generateFitReport stays pair-specific (never cached).
  const llm = withLlmCache(
    createLlmProvider(),
    new PrismaCacheStore("llm"),
    resolveClassificationCacheConfig()
  );
  return { twitter, llm };
}

type UsageStatsCapable = { getUsageStats?: () => unknown };

function readStats(p: unknown): Record<string, unknown> | undefined {
  const stats = (p as UsageStatsCapable).getUsageStats?.();
  return stats && typeof stats === "object"
    ? (stats as Record<string, unknown>)
    : undefined;
}

function intOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}

/**
 * Estimates OpenAI cost (USD) from token counts when per-token prices are set
 * via env (LLM_INPUT_COST_PER_MTOK / LLM_OUTPUT_COST_PER_MTOK, dollars per
 * million tokens). Returns null when unpriced — the raw token counts are always
 * logged regardless, so cost can be recomputed later.
 */
function estimateLlmCostUsd(
  inputTokens: number | null,
  outputTokens: number | null
): number | null {
  const inRate = Number(process.env.LLM_INPUT_COST_PER_MTOK);
  const outRate = Number(process.env.LLM_OUTPUT_COST_PER_MTOK);
  if (!Number.isFinite(inRate) && !Number.isFinite(outRate)) return null;
  const cost =
    ((inputTokens ?? 0) * (Number.isFinite(inRate) ? inRate : 0) +
      (outputTokens ?? 0) * (Number.isFinite(outRate) ? outRate : 0)) /
    1_000_000;
  return Number.isFinite(cost) ? cost : null;
}

/**
 * Persists ProviderUsageLog rows for a completed analysis (best-effort — usage
 * logging must never fail the job). Writes one row per provider that reports
 * usage. Mock providers report no usage, so nothing is written for them.
 */
export async function logProviderUsage(args: {
  requestId: string;
  reportId?: string | null;
  workspaceId?: string | null;
  twitter: unknown;
  llm: unknown;
}): Promise<void> {
  const rows: Prisma.ProviderUsageLogCreateManyInput[] = [];

  const tw = readStats(args.twitter);
  if (tw) {
    const cache = tw.cache as
      | { hits?: number; misses?: number }
      | undefined;
    rows.push({
      requestId: args.requestId,
      reportId: args.reportId ?? null,
      workspaceId: args.workspaceId ?? null,
      provider: process.env.TWITTER_PROVIDER ?? "mock",
      operation: "twitter",
      requests: intOrNull(tw.requests),
      meta: {
        pagesFetched: intOrNull(tw.pagesFetched),
        usersFetched: intOrNull(tw.usersFetched),
        tweetsFetched: intOrNull(tw.tweetsFetched),
        byEndpoint: (tw.byEndpoint as unknown) ?? {},
        cacheHits: intOrNull(cache?.hits),
        cacheMisses: intOrNull(cache?.misses),
      } as Prisma.InputJsonValue,
    });
  }

  const llm = readStats(args.llm);
  if (llm) {
    const tokensIn = intOrNull(llm.inputTokens);
    const tokensOut = intOrNull(llm.outputTokens);
    const costUsd = estimateLlmCostUsd(tokensIn, tokensOut);
    rows.push({
      requestId: args.requestId,
      reportId: args.reportId ?? null,
      workspaceId: args.workspaceId ?? null,
      provider: process.env.LLM_PROVIDER ?? "mock",
      operation: "llm",
      requests: intOrNull(llm.requests),
      tokensIn,
      tokensOut,
      costUsd: costUsd == null ? null : new Prisma.Decimal(costUsd),
      meta: {
        totalTokens: intOrNull(llm.totalTokens),
        byMethod: (llm.byMethod as unknown) ?? {},
        model: process.env.LLM_MODEL ?? null,
        classificationCache: (llm.classificationCache as unknown) ?? null,
      } as Prisma.InputJsonValue,
    });
  }

  if (rows.length === 0) return;
  try {
    await prisma.providerUsageLog.createMany({ data: rows });
  } catch (error) {
    console.error(
      `[worker] failed to write provider usage logs for request ${args.requestId}:`,
      error
    );
  }
}
