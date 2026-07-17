import { AUDIENCE_BUCKET_LABELS, type AudienceBucket } from "./vocab.js";
import type { AudienceDistribution } from "./audience.js";

/**
 * Folds the 15-bucket audience taxonomy down to the handful of segments a
 * part-to-whole chart can actually carry.
 *
 * A donut reads at a glance, and past ~6 slices the arcs get too thin to
 * compare and adjacent colours stop being separable — so drawing every bucket
 * spends colour it cannot cash. This is the pure logic behind that; callers
 * (the web donut today) map segments to their own palette.
 *
 * Rules:
 *  - The low-quality buckets collapse into ONE segment. They already shared the
 *    reserved error tone, so they were never separable from each other by
 *    colour, and the combined number is the one a reader actually acts on.
 *  - Whatever categorical buckets don't fit the budget fold into "Other".
 *  - "Other" and "Low-quality" always sort last, so the tail of the ring is a
 *    fixed neutral→red pair rather than two share-dependent hues.
 *  - Nothing is dropped: a folded segment lists its `members` and sums their
 *    share/count, so every number stays reachable.
 */

export const AUDIENCE_OTHER_KEY = "__other";
export const AUDIENCE_LOW_QUALITY_KEY = "__low_quality";

/** Past this many slices a donut stops being readable. */
export const AUDIENCE_MAX_SEGMENTS = 6;

/** Buckets that indicate low-value engagement (mirrors the scoring signal). */
export const LOW_QUALITY_BUCKETS: readonly AudienceBucket[] = [
  "bots_spam",
  "giveaway_hunters",
  "airdrop_farmers",
];

const LOW_QUALITY_SET = new Set<AudienceBucket>(LOW_QUALITY_BUCKETS);

export type AudienceMember = { label: string; share: number; count: number };

export type AudienceSegment = {
  /** An `AudienceBucket`, or one of the two synthetic fold keys. */
  key: string;
  label: string;
  share: number;
  count: number;
  /** True for the merged low-quality segment (drives the reserved tone). */
  low: boolean;
  /**
   * The buckets folded in here, largest first, each with its own share — a
   * folded slice must still be able to answer "made of what?", or the fold
   * would be hiding the story rather than summarising it. Absent for a plain
   * bucket.
   */
  members?: AudienceMember[];
};

type Row = [AudienceBucket, { count: number; share: number }];

export function foldAudienceSegments(
  distribution: Pick<AudienceDistribution, "buckets">,
  maxSegments: number = AUDIENCE_MAX_SEGMENTS
): AudienceSegment[] {
  const present = (
    Object.entries(distribution.buckets ?? {}) as [
      AudienceBucket,
      { count: number; share: number } | undefined,
    ][]
  ).filter((r): r is Row => (r[1]?.share ?? 0) > 0);

  const sumShare = (rows: Row[]) => rows.reduce((a, [, v]) => a + v.share, 0);
  const sumCount = (rows: Row[]) => rows.reduce((a, [, v]) => a + v.count, 0);
  const membersOf = (rows: Row[]): AudienceMember[] =>
    [...rows]
      .sort((a, b) => b[1].share - a[1].share)
      .map(([b, v]) => ({
        label: AUDIENCE_BUCKET_LABELS[b] ?? b,
        share: v.share,
        count: v.count,
      }));

  const lowRows = present.filter(([b]) => LOW_QUALITY_SET.has(b));
  const mainRows = present
    .filter(([b]) => !LOW_QUALITY_SET.has(b))
    .sort((a, b) => b[1].share - a[1].share);

  // Low-quality always keeps a slice; "Other" only costs one when something
  // actually folds into it. Floor the budget at 1 so a pathological
  // maxSegments can't produce a chart of pure "Other".
  const budget = Math.max(1, maxSegments - (lowRows.length > 0 ? 1 : 0));
  const overflows = mainRows.length > budget;
  const keep = overflows ? Math.max(1, budget - 1) : mainRows.length;

  const out: AudienceSegment[] = mainRows.slice(0, keep).map(([bucket, v]) => ({
    key: bucket,
    label: AUDIENCE_BUCKET_LABELS[bucket] ?? bucket,
    share: v.share,
    count: v.count,
    low: false,
  }));

  const folded = mainRows.slice(keep);
  if (folded.length > 0) {
    out.push({
      key: AUDIENCE_OTHER_KEY,
      label: "Other",
      share: sumShare(folded),
      count: sumCount(folded),
      low: false,
      members: membersOf(folded),
    });
  }
  if (lowRows.length > 0) {
    out.push({
      key: AUDIENCE_LOW_QUALITY_KEY,
      label: "Low-quality",
      share: sumShare(lowRows),
      count: sumCount(lowRows),
      low: true,
      members: membersOf(lowRows),
    });
  }
  return out;
}
