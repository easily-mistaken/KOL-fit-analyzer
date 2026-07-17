"use client";

import * as React from "react";
import {
  AUDIENCE_BUCKET_LABELS,
  type AudienceBucket,
  type AudienceDistribution,
} from "@kol-fit/shared";

import { cn } from "@/lib/utils";

// Buckets that indicate low-value engagement (mirrors the scoring signal).
const LOW_QUALITY = new Set<AudienceBucket>([
  "bots_spam",
  "giveaway_hunters",
  "airdrop_farmers",
]);

/*
 * Categorical identity palette, kept deliberately separate from the brand lime
 * so a slice never reads as a control. Colour follows the BUCKET, never its
 * rank, so a bucket keeps its colour as shares move.
 *
 * The values live in globals.css as --viz-* tokens because light and dark are
 * SELECTED, not flipped: each mode is stepped for its own surface and validated
 * on its own. Both runs clear the lightness band, chroma floor, adjacent-pair
 * CVD, and the normal-vision floor. Re-validate before editing either set:
 *   node scripts/validate_palette.js "<hexes>" --mode dark  --surface "#0a0c10"
 *   node scripts/validate_palette.js "<hexes>" --mode light --surface "#ffffff"
 *
 * Known limit: 11 hues exceed what an 8-slot categorical system can separate
 * under all-pairs, and segment order here is share-dependent, so any two can
 * touch. Identity therefore never rests on colour alone — every slice carries a
 * legend swatch, a label, a percentage, and a hover tooltip. (Light mode also
 * sits in the contrast relief band, which those same labels cover.)
 */
const BUCKET_COLOR: Record<AudienceBucket, string> = {
  developers: "var(--viz-developers)",
  founders: "var(--viz-founders)",
  defi_users: "var(--viz-defi-users)",
  investors_vcs: "var(--viz-investors-vcs)",
  traders: "var(--viz-traders)",
  kols_creators: "var(--viz-creators)",
  ai_crypto: "var(--viz-ai-crypto)",
  infra_research: "var(--viz-infra-research)",
  community_managers: "var(--viz-community-managers)",
  nft_gaming: "var(--viz-nft-gaming)",
  meme_degens: "var(--viz-meme-degens)",
  // "Outside our space" is the neutral slot, so it stays grey by intent rather
  // than spending a hue.
  non_crypto: "var(--viz-neutral)",
  // Low-quality buckets are a reserved status tone, never a categorical hue.
  bots_spam: "var(--viz-low-quality)",
  airdrop_farmers: "var(--viz-low-quality)",
  giveaway_hunters: "var(--viz-low-quality)",
};

const LOW_QUALITY_COLOR = "var(--viz-low-quality)";

type Entry = {
  bucket: AudienceBucket;
  label: string;
  share: number;
  count: number;
  color: string;
  low: boolean;
};

function pctLabel(share: number): string {
  const p = share * 100;
  return p >= 1 || p === 0 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

export function AudienceDonut({
  distribution,
}: {
  distribution: AudienceDistribution;
}) {
  const [hover, setHover] = React.useState<AudienceBucket | null>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const entries: Entry[] = React.useMemo(
    () =>
      (
        Object.entries(distribution.buckets) as [
          AudienceBucket,
          { count: number; share: number } | undefined,
        ][]
      )
        .filter(([, v]) => (v?.share ?? 0) > 0)
        .map(([bucket, v]) => {
          const low = LOW_QUALITY.has(bucket);
          return {
            bucket,
            label: AUDIENCE_BUCKET_LABELS[bucket] ?? bucket,
            share: v?.share ?? 0,
            count: v?.count ?? 0,
            color: low ? LOW_QUALITY_COLOR : BUCKET_COLOR[bucket] ?? "var(--viz-neutral)",
            low,
          };
        })
        .sort((a, b) => b.share - a.share),
    [distribution]
  );

  // Donut geometry
  const size = 216;
  const stroke = 26;
  const r = (size - stroke) / 2 - 6;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  let offset = 0;
  const segments = entries.map((e) => {
    const len = c * e.share;
    const seg = {
      entry: e,
      dasharray: `${Math.max(0, len - 1.6).toFixed(2)} ${(c - len + 1.6).toFixed(2)}`,
      dashoffset: (-offset).toFixed(2),
    };
    offset += len;
    return seg;
  });

  const active = entries.find((e) => e.bucket === hover) ?? null;

  function onMove(e: React.MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div className="grid items-center gap-7 sm:grid-cols-[216px_1fr]">
      <div
        ref={wrapRef}
        className="relative mx-auto"
        style={{ width: size, height: size }}
        onMouseMove={onMove}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          {segments.map((s) => {
            const isHover = hover === s.entry.bucket;
            return (
              <circle
                key={s.entry.bucket}
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={s.entry.color}
                strokeWidth={isHover ? stroke + 4 : stroke}
                strokeDasharray={s.dasharray}
                strokeDashoffset={s.dashoffset}
                style={{
                  cursor: "pointer",
                  opacity: hover && !isHover ? 0.35 : 1,
                  transition: "opacity 120ms, stroke-width 120ms",
                }}
                onMouseEnter={() => setHover(s.entry.bucket)}
                onMouseLeave={() => setHover((h) => (h === s.entry.bucket ? null : h))}
              />
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          {active ? (
            <>
              <div className="font-mono text-2xl font-bold" style={{ color: active.color }}>
                {pctLabel(active.share)}
              </div>
              <div className="max-w-[120px] text-[11px] leading-tight text-secondary-foreground">
                {active.label}
              </div>
            </>
          ) : (
            <>
              {/* Unit 33: no sample counts client-side — neutral label. */}
              <div className="max-w-[110px] text-[12px] font-semibold leading-tight text-foreground">
                Engaged audience
              </div>
              <div className="mt-0.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                by type
              </div>
            </>
          )}
        </div>

        {active && (
          <div
            className="pointer-events-none absolute z-30 flex items-center gap-2 whitespace-nowrap rounded-md border border-strong bg-elevated px-2.5 py-1.5 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
            style={{
              left: pos.x,
              top: pos.y,
              transform: "translate(-50%, -140%)",
            }}
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: active.color }}
            />
            <span className="text-foreground">{active.label}</span>
            <span className="font-mono text-secondary-foreground">
              {pctLabel(active.share)}
            </span>
            <span className="font-mono text-muted-foreground">({active.count})</span>
          </div>
        )}
      </div>

      <ul className="grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {entries.map((e) => (
          <li
            key={e.bucket}
            className={cn(
              "grid cursor-default grid-cols-[12px_1fr_auto] items-center gap-2 rounded px-1 text-[13px] transition-colors",
              hover === e.bucket && "bg-elevated"
            )}
            onMouseEnter={() => setHover(e.bucket)}
            onMouseLeave={() => setHover((h) => (h === e.bucket ? null : h))}
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: e.color }}
            />
            <span className="flex items-center gap-1.5 truncate text-secondary-foreground">
              <span className="truncate">{e.label}</span>
              {e.low && (
                <span className="shrink-0 rounded border border-error/40 px-1 py-px text-[9px] uppercase tracking-wide text-error">
                  low-quality
                </span>
              )}
            </span>
            <span className="font-mono text-xs text-foreground">
              {Math.round(e.share * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
