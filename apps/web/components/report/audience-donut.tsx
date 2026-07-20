"use client";

import * as React from "react";
import {
  AUDIENCE_CRYPTO_NATIVE_KEY,
  AUDIENCE_DOMAIN_PREFIX,
  AUDIENCE_LOW_QUALITY_KEY,
  AUDIENCE_OTHER_KEY,
  foldAudienceSegments,
  type AudienceBucket,
  type AudienceDistribution,
  type AudienceDomain,
  type DomainDistribution,
} from "@kol-fit/shared";

import { cn } from "@/lib/utils";

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
 * Only MAX_SEGMENTS slices ever render (see below), so the number of hues that
 * can touch in one chart stays inside what the palette actually separates.
 * Identity still never rests on colour alone: every slice carries a legend
 * swatch, a label, a percentage, and a hover tooltip. (Light mode sits in the
 * contrast relief band, which those same labels cover.)
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

/*
 * Domain slices render ONLY in the non-crypto-brand layout — and that layout
 * folds the six crypto-only buckets into one slice and replaces the
 * `non_crypto` bucket, freeing seven validated hues. No new colour is
 * introduced: the domains likeliest to carry real share take the freed hues, so
 * they cannot collide with anything else actually on screen.
 *
 * The rare tail (science, news, culture) reuses a role bucket's hue. Bounded
 * and deliberate: only 6 slices ever render, so a collision needs BOTH the rare
 * domain and its twin role bucket to make the cut, and identity never rests on
 * colour alone here — every slice carries a swatch, a label, and a percentage.
 *
 * "Unclear" shares the "Other" grey on purpose. They are the same thing to a
 * reader (uncategorised remainder), so if both render, one grey family reading
 * as one idea is the honest result rather than a third grey nobody can tell
 * apart from the other two.
 */
const DOMAIN_COLOR: Record<AudienceDomain, string> = {
  ai_ml: "var(--viz-ai-crypto)",
  software_tech: "var(--viz-infra-research)",
  finance_business: "var(--viz-traders)",
  creative_media: "var(--viz-meme-degens)",
  gaming_esports: "var(--viz-defi-users)",
  general_consumer: "var(--viz-neutral)",
  science_academia: "var(--viz-developers)",
  news_politics: "var(--viz-community-managers)",
  culture_lifestyle: "var(--viz-creators)",
  unknown: "var(--viz-other)",
};

const LOW_QUALITY_COLOR = "var(--viz-low-quality)";
const OTHER_COLOR = "var(--viz-other)";
/** The folded crypto-only buckets. Takes `nft_gaming`'s hue — one of the very
 *  buckets folded INTO it, so it is free by construction. */
const CRYPTO_NATIVE_COLOR = "var(--viz-nft-gaming)";

const TIP_WIDTH = 210;
/** Below this pointer height there isn't room to sit above the cursor. */
const TIP_FLIP_Y = 150;

/** Which slices exist (and the fold rules) is pure logic in @kol-fit/shared;
 *  this component only paints them. */
function colorFor(key: string): string {
  if (key === AUDIENCE_LOW_QUALITY_KEY) return LOW_QUALITY_COLOR;
  if (key === AUDIENCE_OTHER_KEY) return OTHER_COLOR;
  if (key === AUDIENCE_CRYPTO_NATIVE_KEY) return CRYPTO_NATIVE_COLOR;
  if (key.startsWith(AUDIENCE_DOMAIN_PREFIX)) {
    const d = key.slice(AUDIENCE_DOMAIN_PREFIX.length) as AudienceDomain;
    return DOMAIN_COLOR[d] ?? OTHER_COLOR;
  }
  return BUCKET_COLOR[key as AudienceBucket] ?? OTHER_COLOR;
}

function pctLabel(share: number): string {
  const p = share * 100;
  return p >= 1 || p === 0 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

export function AudienceDonut({
  distribution,
  domains,
  cryptoNative = true,
}: {
  distribution: AudienceDistribution;
  /** What the outside-crypto accounts are about. Absent on pre-v4 reports. */
  domains?: DomainDistribution;
  /** Is the BRAND crypto-native? Chooses the layout — see foldAudienceSegments. */
  cryptoNative?: boolean;
}) {
  const [hover, setHover] = React.useState<string | null>(null);
  // The floating tooltip is anchored to the pointer's position inside the ring,
  // so it may only show for a hover that originated there. Legend rows also set
  // `hover` (to cross-highlight the slice) but never move `pos`, which would
  // otherwise render the tooltip at a stale origin, clipped off-screen.
  const [tipFor, setTipFor] = React.useState<string | null>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const entries = React.useMemo(
    () =>
      foldAudienceSegments(distribution, { domains, cryptoNative }).map((s) => ({
        ...s,
        color: colorFor(s.key),
      })),
    [distribution, domains, cryptoNative]
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

  const active = entries.find((e) => e.key === hover) ?? null;

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
            const isHover = hover === s.entry.key;
            return (
              <circle
                key={s.entry.key}
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
                onMouseEnter={() => {
                  setHover(s.entry.key);
                  setTipFor(s.entry.key);
                }}
                onMouseLeave={() => {
                  setHover((h) => (h === s.entry.key ? null : h));
                  setTipFor((t) => (t === s.entry.key ? null : t));
                }}
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

        {active && tipFor === active.key && (
          <div
            className="pointer-events-none absolute z-30 w-[210px] rounded-md border border-strong bg-elevated px-2.5 py-1.5 text-xs shadow-card"
            style={{
              // The ring is only ~216px wide, so a tooltip anchored to the
              // pointer would hang off its left edge and out of the card. Keep
              // it clamped, and drop it below the pointer when a folded slice's
              // breakdown is too tall to sit above.
              left: Math.max(pos.x, TIP_WIDTH / 2),
              top: pos.y,
              transform:
                pos.y > TIP_FLIP_Y
                  ? "translate(-50%, calc(-100% - 12px))"
                  : "translate(-50%, 12px)",
            }}
          >
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: active.color }}
              />
              <span className="text-foreground">{active.label}</span>
              <span className="font-mono text-secondary-foreground">
                {pctLabel(active.share)}
              </span>
              <span className="font-mono text-muted-foreground">
                ({active.count})
              </span>
            </div>
            {/* A folded slice breaks itself down, so the fold summarises the
                tail rather than hiding it. */}
            {active.members && (
              <ul className="mt-1.5 space-y-0.5 border-t border-default pt-1.5 text-[11px] leading-snug">
                {active.members.map((m) => (
                  <li
                    key={m.label}
                    className="flex items-center justify-between gap-3 whitespace-nowrap"
                  >
                    <span className="text-secondary-foreground">{m.label}</span>
                    <span className="font-mono text-muted-foreground">
                      {pctLabel(m.share)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <ul className="grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {entries.map((e) => (
          <li
            key={e.key}
            title={
              e.members
                ? `${e.label}: ${e.members.map((m) => `${m.label} ${pctLabel(m.share)}`).join(", ")}`
                : undefined
            }
            className={cn(
              "grid cursor-default grid-cols-[12px_1fr_auto] items-center gap-2 rounded px-1 text-[13px] transition-colors",
              hover === e.key && "bg-elevated"
            )}
            onMouseEnter={() => setHover(e.key)}
            onMouseLeave={() => setHover((h) => (h === e.key ? null : h))}
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: e.color }}
            />
            <span className="flex items-center gap-1.5 truncate text-secondary-foreground">
              <span className="truncate">{e.label}</span>
              {e.members && (
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  ({e.members.length})
                </span>
              )}
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
