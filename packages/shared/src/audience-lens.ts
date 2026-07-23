import { z } from "zod";

import type { AudienceDistribution } from "./audience.js";
import {
  CRYPTO_DOMAINS,
  type AudienceDomain,
  type AudienceRole,
} from "./vocab.js";

/*
 * Brand-lens audience presentation (Unit 49).
 *
 * The product serves two kinds of brands, AI and Web3, and the same audience
 * must read in each brand's own language: an AI founder should meet "AI
 * builders and researchers" before "crypto infra", and a DeFi founder the
 * reverse. This is PURE PRESENTATION over the role x domain classification we
 * already store. The classification itself stays brand-agnostic (that is what
 * lets one creator's audience be classified once and reused by every brand,
 * see vocab.ts); the lens only groups, orders, and labels.
 */

// --- the joint role x domain matrix ------------------------------------------

/**
 * Joint role x domain tally of the REAL (quality === "real") classified
 * accounts, keyed `role/domain`. Shares are over ALL classified accounts, so
 * lens groups + the junk share sum to ~1. Computed by the pipeline and stored
 * on the report (the stored distribution only has per-axis marginals, which
 * cannot say who the "DeFi traders" are). Optional on old reports, which fall
 * back to a domain-only lens.
 */
export const AudienceMatrixSchema = z.record(
  z.string(),
  z.object({ count: z.number().int().min(0), share: z.number().min(0).max(1) })
);
export type AudienceMatrix = z.infer<typeof AudienceMatrixSchema>;

export const matrixKey = (role: string, domain: string): string =>
  `${role}/${domain}`;

// --- which lens is this brand looking through --------------------------------

export type BrandLens = "web3" | "ai" | "neutral";

const TECH_DOMAINS: readonly AudienceDomain[] = ["ai", "software"];

/**
 * Resolve the lens from the brand's classified target domains (already on the
 * report as `targeting`). Primary domains count double. Ties with any crypto
 * presence read as web3 (a crypto-AI brand lives on crypto Twitter); no signal
 * on either side means no lens, and the caller shows the neutral view.
 */
export function resolveBrandLens(
  primaryDomains: readonly AudienceDomain[] | undefined,
  secondaryDomains?: readonly AudienceDomain[]
): BrandLens {
  let crypto = 0;
  let tech = 0;
  const tally = (domains: readonly AudienceDomain[] | undefined, w: number) => {
    for (const d of domains ?? []) {
      if ((CRYPTO_DOMAINS as readonly string[]).includes(d)) crypto += w;
      if ((TECH_DOMAINS as readonly string[]).includes(d)) tech += w;
    }
  };
  tally(primaryDomains, 2);
  tally(secondaryDomains, 1);
  if (crypto === 0 && tech === 0) return "neutral";
  return crypto >= tech ? "web3" : "ai";
}

// --- lens group definitions ---------------------------------------------------

export type LensGroupDef = {
  key: string;
  label: string;
  /** null = any role. */
  roles: readonly AudienceRole[] | null;
  /** null = any domain (the catch-all). */
  domains: readonly AudienceDomain[] | null;
  /** Counts toward the "in your world" headline share. */
  inWorld: boolean;
};

// First match wins, so order defines precedence and the groups stay disjoint.
// Every list ends in a catch-all so no share is ever dropped.
const WEB3_GROUPS: readonly LensGroupDef[] = [
  { key: "defi_traders", label: "DeFi traders and users", roles: ["trader", "enthusiast"], domains: ["crypto_defi"], inWorld: true },
  { key: "degens", label: "Degens and memecoin crowd", roles: null, domains: ["crypto_memecoins"], inWorld: true },
  { key: "crypto_builders", label: "Crypto builders and researchers", roles: ["developer", "researcher"], domains: CRYPTO_DOMAINS, inWorld: true },
  { key: "nft_gaming", label: "NFT and gaming crowd", roles: null, domains: ["crypto_nft_gaming"], inWorld: true },
  { key: "crypto_capital", label: "Crypto founders, VCs and operators", roles: ["founder", "investor", "operator", "creator"], domains: CRYPTO_DOMAINS, inWorld: true },
  { key: "crypto_other", label: "Other crypto natives", roles: null, domains: CRYPTO_DOMAINS, inWorld: true },
  { key: "tech_crossover", label: "AI and tech crossover", roles: null, domains: TECH_DOMAINS, inWorld: false },
  { key: "outside", label: "Outside crypto or unclear", roles: null, domains: null, inWorld: false },
];

const AI_GROUPS: readonly LensGroupDef[] = [
  { key: "ai_builders", label: "AI builders and researchers", roles: ["developer", "researcher"], domains: ["ai"], inWorld: true },
  { key: "software_engineers", label: "Software engineers", roles: ["developer", "researcher"], domains: ["software"], inWorld: true },
  { key: "tech_founders", label: "Tech founders and operators", roles: ["founder", "operator"], domains: TECH_DOMAINS, inWorld: true },
  { key: "tech_investors", label: "Tech and fintech investors", roles: ["investor"], domains: ["ai", "software", "finance"], inWorld: true },
  { key: "ai_curious", label: "AI-curious adopters", roles: null, domains: ["ai"], inWorld: true },
  { key: "tech_audience", label: "Broader tech audience", roles: null, domains: ["software"], inWorld: true },
  { key: "crypto_native", label: "Crypto-native builders", roles: ["developer", "researcher", "founder"], domains: CRYPTO_DOMAINS, inWorld: false },
  { key: "outside", label: "Outside tech or unclear", roles: null, domains: null, inWorld: false },
];

// Domain-only fallback for reports saved before the matrix existed. The domain
// marginals include junk accounts, so this path shows NO separate junk segment
// (the quality strip below the donuts still does) and simply groups domains.
const WEB3_FALLBACK: readonly LensGroupDef[] = [
  { key: "defi", label: "DeFi", roles: null, domains: ["crypto_defi"], inWorld: true },
  { key: "degens", label: "Memecoins", roles: null, domains: ["crypto_memecoins"], inWorld: true },
  { key: "infra", label: "Crypto infra", roles: null, domains: ["crypto_infra"], inWorld: true },
  { key: "nft_gaming", label: "NFT and gaming", roles: null, domains: ["crypto_nft_gaming"], inWorld: true },
  { key: "tech_crossover", label: "AI and tech crossover", roles: null, domains: TECH_DOMAINS, inWorld: false },
  { key: "outside", label: "Outside crypto or unclear", roles: null, domains: null, inWorld: false },
];

const AI_FALLBACK: readonly LensGroupDef[] = [
  { key: "ai", label: "AI and ML", roles: null, domains: ["ai"], inWorld: true },
  { key: "software", label: "Software and tech", roles: null, domains: ["software"], inWorld: true },
  { key: "finance", label: "Finance and fintech", roles: null, domains: ["finance"], inWorld: false },
  { key: "crypto", label: "Crypto crossover", roles: null, domains: CRYPTO_DOMAINS, inWorld: false },
  { key: "outside", label: "Outside tech or unclear", roles: null, domains: null, inWorld: false },
];

/** The lens's in-world DOMAINS, for light-touch uses (the live glimpse
 *  ordering) that have no role data in hand. */
export function lensWorldDomains(lens: BrandLens): readonly AudienceDomain[] {
  if (lens === "web3") return CRYPTO_DOMAINS;
  if (lens === "ai") return TECH_DOMAINS;
  return [];
}

// --- building the view --------------------------------------------------------

export type LensGroup = {
  key: string;
  label: string;
  share: number;
  count: number;
  inWorld: boolean;
};

export type LensView = {
  lens: Exclude<BrandLens, "neutral">;
  /** Sum of the inWorld group shares: the headline number. */
  inWorldShare: number;
  /** Non-empty groups in definition order (in-world first by construction). */
  groups: LensGroup[];
  /** True when built from the joint matrix; false = domain-only fallback. */
  joint: boolean;
};

const firstMatch = (
  defs: readonly LensGroupDef[],
  role: string | null,
  domain: string
): LensGroupDef =>
  defs.find(
    (g) =>
      (g.roles === null || (role !== null && (g.roles as readonly string[]).includes(role))) &&
      (g.domains === null || (g.domains as readonly string[]).includes(domain))
  ) ?? defs[defs.length - 1];

/**
 * Group the audience for one lens. Returns null for the neutral lens or an
 * empty sample, in which case the caller renders the standard view only.
 */
export function buildLensView(args: {
  lens: BrandLens;
  distribution: AudienceDistribution;
  matrix?: AudienceMatrix;
}): LensView | null {
  const { lens, distribution, matrix } = args;
  if (lens === "neutral") return null;
  if ((distribution.sampleSize ?? 0) === 0) return null;

  const joint = Boolean(matrix && Object.keys(matrix).length > 0);
  const defs = joint
    ? lens === "web3"
      ? WEB3_GROUPS
      : AI_GROUPS
    : lens === "web3"
      ? WEB3_FALLBACK
      : AI_FALLBACK;

  const acc = new Map<string, LensGroup>();
  const add = (def: LensGroupDef, share: number, count: number) => {
    const g = acc.get(def.key) ?? {
      key: def.key,
      label: def.label,
      share: 0,
      count: 0,
      inWorld: def.inWorld,
    };
    g.share += share;
    g.count += count;
    acc.set(def.key, g);
  };

  if (joint) {
    for (const [key, bin] of Object.entries(matrix!)) {
      const slash = key.indexOf("/");
      if (slash <= 0) continue;
      add(
        firstMatch(defs, key.slice(0, slash), key.slice(slash + 1)),
        bin.share,
        bin.count
      );
    }
    // Junk is real information in a "who actually listens" product: one
    // reserved segment, never folded into a lens group.
    let junkShare = 0;
    let junkCount = 0;
    for (const q of ["bot", "farmer", "giveaway_hunter"] as const) {
      junkShare += distribution.quality[q]?.share ?? 0;
      junkCount += distribution.quality[q]?.count ?? 0;
    }
    if (junkShare > 0) {
      acc.set("low_quality", {
        key: "low_quality",
        label: "Low quality engagement",
        share: junkShare,
        count: junkCount,
        inWorld: false,
      });
    }
  } else {
    for (const [domain, bin] of Object.entries(distribution.domains ?? {})) {
      if (!bin || bin.share <= 0) continue;
      add(firstMatch(defs, null, domain), bin.share, bin.count);
    }
  }

  const order = [...defs.map((d) => d.key), "low_quality"];
  const groups = order
    .map((k) => acc.get(k))
    .filter((g): g is LensGroup => Boolean(g && g.share > 0));
  if (groups.length === 0) return null;

  return {
    lens,
    inWorldShare: groups.reduce((s, g) => s + (g.inWorld ? g.share : 0), 0),
    groups,
    joint,
  };
}
