import * as React from "react";
import type {
  AudienceDomain,
  AudienceRegion,
  AudienceRole,
  ExpectedReach,
  FitReport,
  RegionDistribution,
} from "@kol-fit/shared";
import {
  AUDIENCE_DOMAIN_LABELS,
  AUDIENCE_REGION_LABELS,
  AUDIENCE_ROLE_LABELS,
} from "@kol-fit/shared";

// Unit 41 v3 dials — shown BESIDE the fit score, never blended into it. Expected
// reach answers "how many?" (the fit answers "is this the right audience?"); the
// two stay separate because value = reach ÷ price and only the brand knows price.

// "Infer → confirm" transparency (Phase D): show WHAT the score matched against,
// so the brand can sanity-check the inference the whole number rests on.
export function MatchedAgainst({
  targeting,
}: {
  targeting: NonNullable<FitReport["targeting"]>;
}) {
  // Unit 43: the score matches on two axes, so showing one merged list would
  // misrepresent what it actually rests on — "developers" and "AI" are separate
  // conditions, not one blob.
  const roles = [...targeting.primaryRoles, ...targeting.secondaryRoles];
  const domains = [...targeting.primaryDomains, ...targeting.secondaryDomains];
  if (
    roles.length === 0 &&
    domains.length === 0 &&
    targeting.valuedRegions.length === 0
  ) {
    return null;
  }
  return (
    <div className="mb-4 rounded-xl border border-default bg-elevated p-3.5 text-[12.5px]">
      <span className="font-medium text-muted-foreground">
        Matched against your target:{" "}
      </span>
      {roles.length > 0 ? (
        <span className="text-secondary-foreground">
          {roles.map((r: AudienceRole) => AUDIENCE_ROLE_LABELS[r]).join(", ")}
        </span>
      ) : (
        <span className="text-muted-foreground">a general audience</span>
      )}
      <span className="text-secondary-foreground">
        {" · in "}
        {domains.length > 0 ? (
          domains.map((d: AudienceDomain) => AUDIENCE_DOMAIN_LABELS[d]).join(", ")
        ) : (
          /* An empty domain target is a real answer, not a gap — say so, or a
             reader sees a blank and assumes the inference failed. */
          <span className="text-muted-foreground">any space (no preference)</span>
        )}
      </span>
      {targeting.valuedRegions.length > 0 && (
        <span className="text-secondary-foreground">
          {" · "}valued regions:{" "}
          {targeting.valuedRegions
            .map((r: AudienceRegion) => AUDIENCE_REGION_LABELS[r])
            .join(", ")}
        </span>
      )}
      <span className="mt-1 block text-[11px] text-muted-foreground">
        Not quite right? Add your product and audience details on a new run to
        sharpen the match.
      </span>
    </div>
  );
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return n >= 10 ? `${Math.round(n)}` : `${Math.round(n * 10) / 10}`;
}

export function ExpectedReachCard({ reach }: { reach: ExpectedReach }) {
  const onTarget = Math.round(reach.matchedShareOfEngagers * 100);
  return (
    <div className="rounded-xl border border-default bg-elevated p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Expected reach
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-[26px] font-semibold leading-none text-foreground">
          ~{fmtCount(reach.matchedPerPost)}
        </span>
        <span className="text-[13px] text-secondary-foreground">
          of your target customers engage per post
        </span>
      </div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">
        {fmtCount(reach.avgEngagedPerPost)} engagements on a typical post ·{" "}
        {onTarget}% on-target
      </div>
      <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
        A separate number from the fit score. Weigh it against the creator&apos;s
        price to judge value for money.
      </p>
    </div>
  );
}

export function AudienceGeography({ regions }: { regions: RegionDistribution }) {
  if (regions.placed === 0) return null;
  const entries = Object.entries(regions.regions)
    .map(([region, v]) => ({ region: region as AudienceRegion, ...v }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 6);
  const coveragePct = Math.round(regions.coverage * 100);
  const max = entries[0]?.share || 1;
  return (
    <div className="rounded-xl border border-default bg-elevated p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Audience geography
        </div>
        <div className="text-[11px] text-muted-foreground">
          {coveragePct}% located
        </div>
      </div>
      <div className="grid gap-1.5">
        {entries.map((e) => (
          <div
            key={e.region}
            className="grid grid-cols-[minmax(96px,auto)_1fr_34px] items-center gap-2.5 text-[12.5px]"
          >
            <span className="truncate text-secondary-foreground">
              {AUDIENCE_REGION_LABELS[e.region] ?? e.region}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-inset">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(4, (e.share / max) * 100)}%`,
                  backgroundColor: "var(--accent-primary)",
                }}
              />
            </span>
            <span className="text-right font-mono tabular-nums text-muted-foreground">
              {Math.round(e.share * 100)}%
            </span>
          </div>
        ))}
      </div>
      {coveragePct < 25 && (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Location is sparse on X. This is directional, based on the{" "}
          {coveragePct}% of the audience we could place.
        </p>
      )}
    </div>
  );
}
