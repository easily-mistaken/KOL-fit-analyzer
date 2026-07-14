import type { EngagedAccountRaw } from "@kol-fit/shared";

/**
 * Flatten engaged accounts from multiple posts, dedupe by `user.id` (first
 * occurrence wins, preserving its source and text), and cap at `maxUnique`.
 * Each kept account carries `appearances` = the number of DISTINCT analyzed
 * posts it engaged with (Unit 29A repeat-engager signal). Counting continues
 * after the cap is reached (only *adding new* accounts stops), so repeat
 * evidence is not order-truncated. Deterministic (input order preserved).
 */
export function collectEngagedAccounts(
  groups: EngagedAccountRaw[][],
  maxUnique: number
): EngagedAccountRaw[] {
  const kept = new Map<string, EngagedAccountRaw>();
  const tweetsSeen = new Map<string, Set<string>>();
  for (const group of groups) {
    for (const account of group) {
      const id = account.user.id;
      const existing = kept.get(id);
      if (existing) {
        const tweets = tweetsSeen.get(id)!;
        if (!tweets.has(account.tweetId)) {
          tweets.add(account.tweetId);
          existing.appearances = (existing.appearances ?? 1) + 1;
        }
        continue;
      }
      if (kept.size >= maxUnique) continue;
      kept.set(id, { ...account, appearances: 1 });
      tweetsSeen.set(id, new Set([account.tweetId]));
    }
  }
  return [...kept.values()];
}
