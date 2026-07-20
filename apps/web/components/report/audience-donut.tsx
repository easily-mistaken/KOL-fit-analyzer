"use client";

import * as React from "react";
import {
  AUDIENCE_OTHER_KEY,
  AUDIENCE_QUALITY_LABELS,
  foldDomainSegments,
  foldRoleSegments,
  type AudienceDistribution,
  type AudienceDomain,
  type AudienceQuality,
  type AudienceRole,
  type AudienceSegment,
} from "@kol-fit/shared";

import { cn } from "@/lib/utils";

/*
 * Categorical identity palette, kept deliberately separate from the brand lime
 * so a slice never reads as a control. Colour follows the VALUE, never its
 * rank, so a value keeps its colour as shares move.
 *
 * The values live in globals.css as --viz-* tokens because light and dark are
 * SELECTED, not flipped: each mode is stepped for its own surface and validated
 * on its own. Both runs clear the lightness band, chroma floor, adjacent-pair
 * CVD, and the normal-vision floor. Re-validate before editing either set:
 *   node scripts/validate_palette.js "<hexes>" --mode dark  --surface "#0a0c10"
 *   node scripts/validate_palette.js "<hexes>" --mode light --surface "#ffffff"
 *
 * Unit 43 split the taxonomy onto three axes, which made the palette problem
 * EASIER rather than harder: role and domain are drawn as two separate charts,
 * so their colours never compete inside one ring, and each axis only ever shows
 * MAX_SEGMENTS slices. The two maps below may therefore reuse the same eleven
 * validated hues independently. Quality is not a categorical axis at all — it
 * is one ordered good→bad reading, so it gets a strip rather than a ring.
 *
 * Identity still never rests on colour alone: every slice carries a legend
 * swatch, a label, a percentage, and a hover tooltip.
 */
const DOMAIN_COLOR: Record<AudienceDomain, string> = {
  crypto_defi: "var(--viz-defi-users)",
  crypto_infra: "var(--viz-infra-research)",
  crypto_nft_gaming: "var(--viz-nft-gaming)",
  crypto_memecoins: "var(--viz-meme-degens)",
  ai: "var(--viz-ai-crypto)",
  software: "var(--viz-developers)",
  finance: "var(--viz-traders)",
  creative: "var(--viz-creators)",
  gaming: "var(--viz-investors-vcs)",
  science: "var(--viz-community-managers)",
  culture: "var(--viz-founders)",
  // 14 domains against 11 validated categorical hues + 2 neutrals, so exactly
  // one pair must share. `news_politics` doubles up with `culture`: both are
  // general-interest, non-professional domains, so on the rare run where both
  // make the top 6 the repeated hue reads as one "general interest" family
  // rather than as a mislabel. The legend labels every slice regardless.
  news_politics: "var(--viz-founders)",
  general: "var(--viz-neutral)",
  unknown: "var(--viz-other)",
};

const ROLE_COLOR: Record<AudienceRole, string> = {
  founder: "var(--viz-founders)",
  developer: "var(--viz-developers)",
  investor: "var(--viz-investors-vcs)",
  trader: "var(--viz-traders)",
  researcher: "var(--viz-infra-research)",
  creator: "var(--viz-creators)",
  operator: "var(--viz-community-managers)",
  enthusiast: "var(--viz-defi-users)",
  unknown: "var(--viz-other)",
};

/** Quality is ORDERED (real → junk), not categorical, so it reads on one
 *  good-to-bad ramp ending in the reserved error tone. */
const QUALITY_COLOR: Record<AudienceQuality, string> = {
  real: "var(--viz-defi-users)",
  farmer: "var(--viz-traders)",
  giveaway_hunter: "var(--viz-founders)",
  bot: "var(--viz-low-quality)",
};

const OTHER_COLOR = "var(--viz-other)";

const TIP_WIDTH = 210;
/** Below this pointer height there isn't room to sit above the cursor. */
const TIP_FLIP_Y = 150;

function pctLabel(share: number): string {
  const p = share * 100;
  return p >= 1 || p === 0 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

type Entry = AudienceSegment & { color: string };

/** One donut over one axis. Which slices exist (and the fold rules) is pure
 *  logic in @kol-fit/shared; this only paints them. */
function AxisDonut({
  entries,
  caption,
  sub,
  size = 176,
}: {
  entries: Entry[];
  caption: string;
  sub: string;
  size?: number;
}) {
  const [hover, setHover] = React.useState<string | null>(null);
  // The floating tooltip is anchored to the pointer's position inside the ring,
  // so it may only show for a hover that originated there. Legend rows also set
  // `hover` (to cross-highlight the slice) but never move `pos`, which would
  // otherwise render the tooltip at a stale origin, clipped off-screen.
  const [tipFor, setTipFor] = React.useState<string | null>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const stroke = 22;
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
    <div>
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
              <div
                className="font-mono text-xl font-bold"
                style={{ color: active.color }}
              >
                {pctLabel(active.share)}
              </div>
              <div className="max-w-[104px] text-[11px] leading-tight text-secondary-foreground">
                {active.label}
              </div>
            </>
          ) : (
            <>
              {/* Unit 33: no sample counts client-side — neutral label. */}
              <div className="max-w-[104px] text-[12px] font-semibold leading-tight text-foreground">
                {caption}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {sub}
              </div>
            </>
          )}
        </div>

        {active && tipFor === active.key && (
          <div
            className="pointer-events-none absolute z-30 w-[210px] rounded-md border border-strong bg-elevated px-2.5 py-1.5 text-xs shadow-card"
            style={{
              // The ring is only ~176px wide, so a tooltip anchored to the
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

      <ul className="mt-3 grid gap-x-4 gap-y-1">
        {entries.map((e) => (
          <li
            key={e.key}
            title={
              e.members
                ? `${e.label}: ${e.members.map((m) => `${m.label} ${pctLabel(m.share)}`).join(", ")}`
                : undefined
            }
            className={cn(
              "grid cursor-default grid-cols-[12px_1fr_auto] items-center gap-2 rounded px-1 text-[12.5px] transition-colors",
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

/**
 * Engagement quality as one ordered strip rather than a fourth ring. Quality is
 * not a categorical question — there is a right answer and the rest are
 * degrees of wrong — so ranking it good→bad says more than a pie ever could,
 * and it keeps the two categorical rings free of a reserved error tone.
 */
function QualityStrip({ distribution }: { distribution: AudienceDistribution }) {
  const order: AudienceQuality[] = ["real", "farmer", "giveaway_hunter", "bot"];
  const rows = order
    .map((q) => ({ q, bin: distribution.quality[q] }))
    .filter((r) => (r.bin?.share ?? 0) > 0);
  if (rows.length === 0) return null;

  return (
    <div className="mt-6 border-t border-default pt-4">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Engagement quality
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        {rows.map(({ q, bin }) => (
          <div
            key={q}
            title={`${AUDIENCE_QUALITY_LABELS[q]} ${pctLabel(bin!.share)}`}
            style={{
              width: `${bin!.share * 100}%`,
              backgroundColor: QUALITY_COLOR[q],
            }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {rows.map(({ q, bin }) => (
          <li key={q} className="flex items-center gap-1.5 text-[12px]">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: QUALITY_COLOR[q] }}
            />
            <span className="text-secondary-foreground">
              {AUDIENCE_QUALITY_LABELS[q]}
            </span>
            <span className="font-mono text-xs text-foreground">
              {pctLabel(bin!.share)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AudienceDonut({
  distribution,
}: {
  distribution: AudienceDistribution;
}) {
  const domains = React.useMemo(
    () =>
      foldDomainSegments(distribution).map((s) => ({
        ...s,
        color:
          s.key === AUDIENCE_OTHER_KEY
            ? OTHER_COLOR
            : (DOMAIN_COLOR[s.key as AudienceDomain] ?? OTHER_COLOR),
      })),
    [distribution]
  );
  const roles = React.useMemo(
    () =>
      foldRoleSegments(distribution).map((s) => ({
        ...s,
        color:
          s.key === AUDIENCE_OTHER_KEY
            ? OTHER_COLOR
            : (ROLE_COLOR[s.key as AudienceRole] ?? OTHER_COLOR),
      })),
    [distribution]
  );

  return (
    <div>
      <div className="grid gap-8 sm:grid-cols-2">
        <AxisDonut
          entries={domains}
          caption="What they're into"
          sub="by domain"
        />
        <AxisDonut entries={roles} caption="What they do" sub="by role" />
      </div>
      <QualityStrip distribution={distribution} />
    </div>
  );
}
