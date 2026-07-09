import type { EngagedAccountRaw } from "@kol-fit/shared";

/**
 * Flatten engaged accounts from multiple posts, dedupe by `user.id` (first
 * occurrence wins, preserving its source), and cap at `maxUnique`. Deterministic
 * order (input order preserved).
 */
export function collectEngagedAccounts(
  groups: EngagedAccountRaw[][],
  maxUnique: number
): EngagedAccountRaw[] {
  const seen = new Set<string>();
  const out: EngagedAccountRaw[] = [];
  for (const group of groups) {
    for (const account of group) {
      if (out.length >= maxUnique) return out;
      const id = account.user.id;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(account);
    }
  }
  return out;
}
