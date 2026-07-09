import type { Tweet } from "@kol-fit/shared";

/** Engagement heuristic for ranking posts (missing counts -> 0). */
export function engagementScore(t: Tweet): number {
  return (
    (t.likeCount ?? 0) +
    (t.retweetCount ?? 0) +
    (t.replyCount ?? 0) +
    (t.quoteCount ?? 0)
  );
}

/**
 * Deterministically select the top `limit` posts by engagement. Ties break by
 * tweet id so the result is stable regardless of input order.
 */
export function selectTopPosts(posts: Tweet[], limit: number): Tweet[] {
  return [...posts]
    .sort((a, b) => {
      const diff = engagementScore(b) - engagementScore(a);
      if (diff !== 0) return diff;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .slice(0, Math.max(0, limit));
}
