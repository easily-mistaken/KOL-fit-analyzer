import type { EngagedAccountRaw } from "@kol-fit/shared";

/**
 * Deterministically selects a representative sample of engaged accounts to
 * classify, capped at `limit` (Unit 19 cost control). Unlike the previous
 * first-N slice, this:
 *   1. Allocates the budget proportionally across engagement sources
 *      (REPLY/QUOTE/RETWEET), using largest-remainder rounding so the parts
 *      sum exactly to `limit`.
 *   2. Within each source group, sorts by a stable key (user id) and picks
 *      evenly-spaced accounts, so the sample spans the whole group instead of
 *      clustering at the front.
 * Fully deterministic: identical input → identical output, so cached runs and
 * re-runs classify the same accounts.
 */
export function sampleAudienceAccounts(
  accounts: EngagedAccountRaw[],
  limit: number
): EngagedAccountRaw[] {
  if (limit <= 0) return [];
  if (accounts.length <= limit) return stableSort(accounts);

  // Group by source, each group stably ordered by user id.
  const groups = new Map<string, EngagedAccountRaw[]>();
  for (const a of accounts) {
    const g = groups.get(a.source);
    if (g) g.push(a);
    else groups.set(a.source, [a]);
  }
  // Deterministic group iteration order (by source name).
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  for (const [, g] of ordered) sortInPlace(g);

  const total = accounts.length;
  // Proportional quotas via largest-remainder.
  const quotas = ordered.map(([source, g]) => ({
    source,
    group: g,
    exact: (g.length / total) * limit,
    take: Math.floor((g.length / total) * limit),
  }));
  let allocated = quotas.reduce((s, q) => s + q.take, 0);
  const byRemainder = [...quotas].sort(
    (a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact))
  );
  let i = 0;
  while (allocated < limit && byRemainder.length > 0) {
    const q = byRemainder[i % byRemainder.length];
    if (q.take < q.group.length) {
      q.take++;
      allocated++;
    }
    i++;
    // Safety: if every group is maxed out, stop.
    if (i > byRemainder.length * 2 && allocated < limit) break;
  }

  const picked: EngagedAccountRaw[] = [];
  for (const q of quotas) picked.push(...pickEvenlySpaced(q.group, q.take));
  return picked;
}

/** Picks `n` evenly-spaced items across `arr` (already stably ordered). */
function pickEvenlySpaced<T>(arr: T[], n: number): T[] {
  if (n >= arr.length) return arr.slice();
  if (n <= 0) return [];
  const out: T[] = [];
  const stride = arr.length / n;
  for (let k = 0; k < n; k++) out.push(arr[Math.floor(k * stride)]);
  return out;
}

function stableSort(arr: EngagedAccountRaw[]): EngagedAccountRaw[] {
  const copy = arr.slice();
  sortInPlace(copy);
  return copy;
}

function sortInPlace(arr: EngagedAccountRaw[]): void {
  arr.sort((a, b) => (a.user.id < b.user.id ? -1 : a.user.id > b.user.id ? 1 : 0));
}
