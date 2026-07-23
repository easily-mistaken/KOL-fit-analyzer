"use client";

import * as React from "react";
import {
  buildLensView,
  resolveBrandLens,
  type AudienceDistribution,
  type AudienceMatrix,
  type FitReport,
} from "@kol-fit/shared";

/*
 * Brand-lens audience bar (Unit 49): the same classified audience, grouped and
 * ordered in the viewing brand's language. Which groups exist is pure logic in
 * @kol-fit/shared (buildLensView); this paints one stacked composition bar +
 * legend and the "in your world" headline.
 *
 * Colour follows the GROUP, never its rank, and reuses the validated --viz-*
 * hues (see audience-donut.tsx for the validation notes). Within each lens the
 * assignment keeps every adjacent pair on distinct hues; junk wears the
 * reserved low-quality tone, exactly as in the quality strip.
 */
const GROUP_COLOR: Record<string, string> = {
  // web3 lens
  defi_traders: "var(--viz-defi-users)",
  degens: "var(--viz-meme-degens)",
  crypto_builders: "var(--viz-developers)",
  nft_gaming: "var(--viz-nft-gaming)",
  crypto_capital: "var(--viz-founders)",
  crypto_other: "var(--viz-infra-research)",
  tech_crossover: "var(--viz-ai-crypto)",
  // ai lens
  ai_builders: "var(--viz-ai-crypto)",
  software_engineers: "var(--viz-developers)",
  tech_founders: "var(--viz-founders)",
  tech_investors: "var(--viz-investors-vcs)",
  ai_curious: "var(--viz-traders)",
  tech_audience: "var(--viz-community-managers)",
  crypto_native: "var(--viz-infra-research)",
  // domain-only fallback (old reports)
  defi: "var(--viz-defi-users)",
  infra: "var(--viz-infra-research)",
  ai: "var(--viz-ai-crypto)",
  software: "var(--viz-developers)",
  finance: "var(--viz-traders)",
  crypto: "var(--viz-infra-research)",
  // shared
  outside: "var(--viz-neutral)",
  low_quality: "var(--viz-low-quality)",
};

function pctLabel(share: number): string {
  const p = share * 100;
  return p >= 1 || p === 0 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

export function AudienceLensBar({
  distribution,
  matrix,
  targeting,
}: {
  distribution: AudienceDistribution;
  matrix?: AudienceMatrix;
  targeting?: FitReport["targeting"];
}) {
  const view = React.useMemo(() => {
    const lens = resolveBrandLens(
      targeting?.primaryDomains,
      targeting?.secondaryDomains
    );
    return buildLensView({ lens, distribution, matrix });
  }, [distribution, matrix, targeting]);

  if (!view) return null;

  const lensName = view.lens === "web3" ? "Web3" : "AI";

  return (
    <div className="mb-6 border-b border-default pb-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className="font-mono text-[28px] font-bold leading-none"
          style={{
            color:
              view.inWorldShare >= 0.3
                ? "var(--state-success)"
                : "var(--foreground)",
          }}
        >
          {pctLabel(view.inWorldShare)}
        </span>
        <span className="text-[13.5px] text-secondary-foreground">
          of this creator&rsquo;s engaged audience is in your world
        </span>
        <span className="ml-auto rounded-full border border-default px-2 py-0.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
          {lensName} lens
        </span>
      </div>

      <div className="mt-3 flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {view.groups.map((g) => (
          <div
            key={g.key}
            title={`${g.label} ${pctLabel(g.share)} (${g.count})`}
            className="min-w-[3px] first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${g.share * 100}%`,
              backgroundColor: GROUP_COLOR[g.key] ?? "var(--viz-other)",
              opacity: g.inWorld ? 1 : 0.55,
            }}
          />
        ))}
      </div>

      <ul className="mt-2.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {view.groups.map((g) => (
          <li
            key={g.key}
            title={`${g.label}: ${g.count} account(s)`}
            className="grid grid-cols-[12px_1fr_auto] items-center gap-2 text-[12.5px]"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{
                backgroundColor: GROUP_COLOR[g.key] ?? "var(--viz-other)",
                opacity: g.inWorld ? 1 : 0.55,
              }}
            />
            <span className="truncate text-secondary-foreground">
              {g.label}
            </span>
            <span className="font-mono text-xs text-foreground">
              {pctLabel(g.share)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[11.5px] text-muted-foreground">
        Grouped for a {lensName} brand from the same classified audience as the
        charts below.
        {view.joint
          ? " Faded segments sit outside your world."
          : " Older report: grouped by domain only."}
      </p>
    </div>
  );
}
