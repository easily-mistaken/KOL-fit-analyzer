import {
  AUDIENCE_BUCKET_LABELS,
  AUDIENCE_DOMAIN_LABELS,
  CRYPTO_SPECIFIC_BUCKETS,
  type AudienceBucket,
  type AudienceDomain,
} from "./vocab.js";
import type { AudienceDistribution, DomainDistribution } from "./audience.js";

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
 *
 * The taxonomy is crypto-native, so which buckets deserve slices depends on the
 * BRAND. For a crypto brand it is unchanged. For a non-crypto brand the chart
 * would otherwise spend its whole budget on `defi_users` / `meme_degens` /
 * `nft_gaming` — all noise to them — while the part they came for collapsed
 * into a single grey "Outside crypto" slice. So when `cryptoNative` is false we
 * invert it: the `non_crypto` slice opens up by domain, and the crypto-only
 * buckets fold into ONE slice. That fold is labelled "Crypto-native" rather
 * than dumped into "Other" on purpose — a nameless residual is the exact
 * failure being fixed here, and doing it in reverse would be no better.
 */

export const AUDIENCE_OTHER_KEY = "__other";
export const AUDIENCE_LOW_QUALITY_KEY = "__low_quality";
/** The crypto-only buckets, folded into one slice for a non-crypto brand. */
export const AUDIENCE_CRYPTO_NATIVE_KEY = "__crypto_native";
/** Prefix for a domain segment expanded out of the `non_crypto` bucket. */
export const AUDIENCE_DOMAIN_PREFIX = "domain:";

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

/** A slice before the budget is applied — a bucket, a domain, or a pre-fold. */
type Cand = {
  key: string;
  label: string;
  share: number;
  count: number;
  members?: AudienceMember[];
};

export type FoldOptions = {
  maxSegments?: number;
  /**
   * Is the BRAND reading this chart crypto-native? Defaults to true, which is
   * both the historical behaviour and the safe default for a pre-v4 org
   * classification that predates the field.
   */
  cryptoNative?: boolean;
  /** Domain breakdown of `non_crypto`; needed to open that slice up. */
  domains?: DomainDistribution;
};

const CRYPTO_SPECIFIC_SET = new Set<AudienceBucket>(CRYPTO_SPECIFIC_BUCKETS);

/**
 * The domain breakdown as chart rows, largest first.
 *
 * `DomainDistribution` shares are over the OUTSIDE-CRYPTO accounts, but a slice
 * (or a member line beside other slices) is read against the whole sample — so
 * rescale by the bucket's own share. Derived from the count ratio rather than a
 * `sampleSize` the caller isn't required to pass.
 */
function domainRows(
  bucketShare: number,
  domains: DomainDistribution
): Cand[] {
  return (
    Object.entries(domains.domains ?? {}) as [
      AudienceDomain,
      { count: number; share: number } | undefined,
    ][]
  )
    .filter((r) => (r[1]?.count ?? 0) > 0)
    .map(([d, v]) => ({
      key: `${AUDIENCE_DOMAIN_PREFIX}${d}`,
      label: AUDIENCE_DOMAIN_LABELS[d] ?? d,
      share: bucketShare * (v!.count / domains.total),
      count: v!.count,
    }))
    .sort((a, b) => b.share - a.share);
}

const domainMembers = (
  bucketShare: number,
  domains: DomainDistribution
): AudienceMember[] =>
  domainRows(bucketShare, domains).map((r) => ({
    label: r.label,
    share: r.share,
    count: r.count,
  }));

export function foldAudienceSegments(
  distribution: Pick<AudienceDistribution, "buckets">,
  options: FoldOptions = {}
): AudienceSegment[] {
  const {
    maxSegments = AUDIENCE_MAX_SEGMENTS,
    cryptoNative = true,
    domains,
  } = options;

  const present = (
    Object.entries(distribution.buckets ?? {}) as [
      AudienceBucket,
      { count: number; share: number } | undefined,
    ][]
  ).filter((r): r is Row => (r[1]?.share ?? 0) > 0);

  const sumShare = (rows: Cand[]) => rows.reduce((a, r) => a + r.share, 0);
  const sumCount = (rows: Cand[]) => rows.reduce((a, r) => a + r.count, 0);
  const membersOf = (rows: Cand[]): AudienceMember[] =>
    [...rows]
      .sort((a, b) => b.share - a.share)
      .map((r) => ({ label: r.label, share: r.share, count: r.count }));

  const asCand = ([bucket, v]: Row): Cand => ({
    key: bucket,
    label: AUDIENCE_BUCKET_LABELS[bucket] ?? bucket,
    share: v.share,
    count: v.count,
  });

  const lowRows = present.filter(([b]) => LOW_QUALITY_SET.has(b)).map(asCand);
  const rest = present.filter(([b]) => !LOW_QUALITY_SET.has(b));

  let mainRows: Cand[];
  const nonCrypto = rest.find(([b]) => b === "non_crypto");
  // Opening up `non_crypto` needs a domain breakdown to open it INTO; without
  // one (pre-v4 report, or an audience with no outside-crypto accounts) fall
  // through to the crypto-native layout rather than inventing a slice.
  const expand =
    !cryptoNative && nonCrypto !== undefined && (domains?.total ?? 0) > 0;

  if (expand) {
    const [, nc] = nonCrypto!;
    const expanded = domainRows(nc.share, domains!);

    const cryptoRows = rest
      .filter(([b]) => CRYPTO_SPECIFIC_SET.has(b))
      .map(asCand);
    const neutralRows = rest
      .filter(([b]) => b !== "non_crypto" && !CRYPTO_SPECIFIC_SET.has(b))
      .map(asCand);

    mainRows = [...neutralRows, ...expanded];
    if (cryptoRows.length > 0) {
      mainRows.push({
        key: AUDIENCE_CRYPTO_NATIVE_KEY,
        label: "Crypto-native",
        share: sumShare(cryptoRows),
        count: sumCount(cryptoRows),
        members: membersOf(cryptoRows),
      });
    }
  } else {
    // Crypto-native layout: the slices are unchanged, but "Outside crypto" is
    // still a black hole on its own, so it carries the domain breakdown as
    // MEMBERS. The tooltip/legend already renders members for folded slices, so
    // a crypto brand gets the same answer to "what is that 42%?" without
    // spending a single extra slice or hue.
    mainRows = rest.map((row) =>
      row[0] === "non_crypto" && (domains?.total ?? 0) > 0
        ? { ...asCand(row), members: domainMembers(row[1].share, domains!) }
        : asCand(row)
    );
  }
  mainRows.sort((a, b) => b.share - a.share);

  // Low-quality always keeps a slice; "Other" only costs one when something
  // actually folds into it. Floor the budget at 1 so a pathological
  // maxSegments can't produce a chart of pure "Other".
  const budget = Math.max(1, maxSegments - (lowRows.length > 0 ? 1 : 0));
  const overflows = mainRows.length > budget;
  const keep = overflows ? Math.max(1, budget - 1) : mainRows.length;

  const out: AudienceSegment[] = mainRows.slice(0, keep).map((r) => ({
    key: r.key,
    label: r.label,
    share: r.share,
    count: r.count,
    low: false,
    ...(r.members ? { members: r.members } : {}),
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
