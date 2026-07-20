import {
  AUDIENCE_DOMAIN_LABELS,
  AUDIENCE_ROLE_LABELS,
  type AudienceDomain,
  type AudienceRole,
} from "./vocab.js";
import type { AudienceDistribution } from "./audience.js";

/**
 * Folds one axis of the audience distribution down to the handful of segments a
 * part-to-whole chart can actually carry.
 *
 * A donut reads at a glance, and past ~6 slices the arcs get too thin to
 * compare and adjacent colours stop being separable — so drawing every value
 * spends colour it cannot cash. This is the pure logic behind that; callers
 * (the web charts today) map segments to their own palette.
 *
 * Unit 43 made this axis-agnostic. It used to fold the single flat bucket list
 * and needed special cases for the two values that were not really categories:
 * a reserved low-quality slice, and a brand-dependent expansion of the
 * `non_crypto` bucket. Splitting role / domain / quality deleted both — quality
 * is now its own axis with its own display, and "not crypto" is no longer a
 * value at all, just any domain that isn't a crypto one. What's left is the
 * honest core: rank, keep what fits, fold the tail into "Other", and never lose
 * a number (a folded segment lists its `members` and sums their share/count).
 */

export const AUDIENCE_OTHER_KEY = "__other";

/** Past this many slices a donut stops being readable. */
export const AUDIENCE_MAX_SEGMENTS = 6;

export type AudienceMember = { label: string; share: number; count: number };

export type AudienceSegment = {
  /** The axis value, or `AUDIENCE_OTHER_KEY` for the folded tail. */
  key: string;
  label: string;
  share: number;
  count: number;
  /**
   * The values folded in here, largest first, each with its own share — a
   * folded slice must still be able to answer "made of what?", or the fold
   * would be hiding the story rather than summarising it. Absent for a plain
   * value.
   */
  members?: AudienceMember[];
};

type Bin = { count: number; share: number };

/**
 * Rank a distribution record, keep what fits the budget, fold the rest.
 *
 * `labels` doubles as the ORDERING authority for what may appear: a value with
 * no label is still rendered (under its raw key) rather than dropped, because
 * silently losing share would break the one guarantee this function makes.
 */
export function foldSegments(
  record: Partial<Record<string, Bin>> | undefined,
  labels: Record<string, string>,
  maxSegments: number = AUDIENCE_MAX_SEGMENTS
): AudienceSegment[] {
  const rows = Object.entries(record ?? {})
    .filter((r): r is [string, Bin] => (r[1]?.share ?? 0) > 0)
    .map(([key, v]) => ({
      key,
      label: labels[key] ?? key,
      share: v.share,
      count: v.count,
    }))
    .sort((a, b) => b.share - a.share);

  // Floor the budget at 1 so a pathological maxSegments can't produce a chart
  // of pure "Other".
  const budget = Math.max(1, maxSegments);
  const overflows = rows.length > budget;
  const keep = overflows ? Math.max(1, budget - 1) : rows.length;

  const out: AudienceSegment[] = rows.slice(0, keep);
  const folded = rows.slice(keep);
  if (folded.length > 0) {
    out.push({
      key: AUDIENCE_OTHER_KEY,
      label: "Other",
      share: folded.reduce((a, r) => a + r.share, 0),
      count: folded.reduce((a, r) => a + r.count, 0),
      members: folded.map((r) => ({
        label: r.label,
        share: r.share,
        count: r.count,
      })),
    });
  }
  return out;
}

/** The domain axis — "what is this audience about", the headline chart. */
export function foldDomainSegments(
  distribution: Pick<AudienceDistribution, "domains">,
  maxSegments?: number
): AudienceSegment[] {
  return foldSegments(
    distribution.domains as Partial<Record<string, Bin>>,
    AUDIENCE_DOMAIN_LABELS satisfies Record<AudienceDomain, string>,
    maxSegments
  );
}

/** The role axis — "what do these people do". */
export function foldRoleSegments(
  distribution: Pick<AudienceDistribution, "roles">,
  maxSegments?: number
): AudienceSegment[] {
  return foldSegments(
    distribution.roles as Partial<Record<string, Bin>>,
    AUDIENCE_ROLE_LABELS satisfies Record<AudienceRole, string>,
    maxSegments
  );
}
