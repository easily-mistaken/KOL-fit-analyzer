// Analysis depth / cost caps. Values must match architecture.md ->
// "Analysis Depth and Cost Controls". Plain constants for now; environment
// overrides are deferred to Unit 19.
export const ANALYSIS_CAPS = {
  kolPostsFetched: 100,
  kolRepliesFetched: 50,
  topPostsForDeepAnalysis: 20,
  repliesPerPost: 50,
  quotesPerPost: 30,
  retweetersPerPost: 100,
  maxUniqueEngagedAccounts: 1500,
} as const;

export type AnalysisCaps = typeof ANALYSIS_CAPS;
