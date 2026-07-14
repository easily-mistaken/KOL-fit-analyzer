// Analysis depth / cost caps. Values must match architecture.md ->
// "Analysis Depth and Cost Controls". Environment overrides (Unit 19) are
// applied by resolveCaps(); the pipeline stays pure and takes caps as input.
export interface AnalysisCaps {
  kolPostsFetched: number;
  kolRepliesFetched: number;
  topPostsForDeepAnalysis: number;
  repliesPerPost: number;
  quotesPerPost: number;
  retweetersPerPost: number;
  maxUniqueEngagedAccounts: number;
}

export const ANALYSIS_CAPS: AnalysisCaps = {
  kolPostsFetched: 100,
  kolRepliesFetched: 50,
  topPostsForDeepAnalysis: 20,
  repliesPerPost: 50,
  quotesPerPost: 30,
  // 100 -> 50 in Unit 29D: retweets are the weakest engagement signal (scoring
  // v2 weights them 0.5) and the most numerous fetch — halving them buys
  // latency without touching the high-signal reply/quote depth.
  retweetersPerPost: 50,
  maxUniqueEngagedAccounts: 1500,
};

/** Maps each cap to its `ANALYSIS_*` environment override name. Consumed by
 *  resolveCaps() in @kol-fit/analysis (which has access to process.env). */
export const CAP_ENV_VARS: Record<keyof AnalysisCaps, string> = {
  kolPostsFetched: "ANALYSIS_KOL_POSTS_FETCHED",
  kolRepliesFetched: "ANALYSIS_KOL_REPLIES_FETCHED",
  topPostsForDeepAnalysis: "ANALYSIS_TOP_POSTS_FOR_DEEP_ANALYSIS",
  repliesPerPost: "ANALYSIS_REPLIES_PER_POST",
  quotesPerPost: "ANALYSIS_QUOTES_PER_POST",
  retweetersPerPost: "ANALYSIS_RETWEETERS_PER_POST",
  maxUniqueEngagedAccounts: "ANALYSIS_MAX_UNIQUE_ENGAGED_ACCOUNTS",
};
