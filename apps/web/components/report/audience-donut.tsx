import * as React from "react";
import {
  AUDIENCE_BUCKET_LABELS,
  type AudienceBucket,
  type AudienceDistribution,
} from "@kol-fit/shared";

// Buckets that indicate low-value engagement (mirrors the scoring signal).
const LOW_QUALITY = new Set<AudienceBucket>([
  "bots_spam",
  "giveaway_hunters",
  "airdrop_farmers",
]);

// Curated palette harmonising with the violet/blue accent world. Low-quality
// buckets always render in the error tone regardless of this map.
const BUCKET_COLOR: Record<AudienceBucket, string> = {
  community_managers: "#6D5EF7",
  kols_creators: "#8175FF",
  non_crypto: "#5A6478",
  developers: "#4DA3FF",
  founders: "#5B8DEF",
  ai_crypto: "#3FB6C9",
  traders: "#35D07F",
  infra_research: "#6E7B9E",
  meme_degens: "#B08CFF",
  nft_gaming: "#9B8CFF",
  investors_vcs: "#4A6FE0",
  defi_users: "#2FB477",
  bots_spam: "#FF5C6C",
  airdrop_farmers: "#FF7A86",
  giveaway_hunters: "#FF9AA3",
};

const LOW_QUALITY_COLOR = "#FF5C6C";

type Entry = {
  bucket: AudienceBucket;
  label: string;
  share: number;
  color: string;
  low: boolean;
};

export function AudienceDonut({
  distribution,
}: {
  distribution: AudienceDistribution;
}) {
  const entries: Entry[] = (
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
        color: low ? LOW_QUALITY_COLOR : BUCKET_COLOR[bucket] ?? "#5A6478",
        low,
      };
    })
    .sort((a, b) => b.share - a.share);

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
      color: e.color,
      dasharray: `${Math.max(0, len - 1.6).toFixed(2)} ${(c - len + 1.6).toFixed(2)}`,
      dashoffset: (-offset).toFixed(2),
    };
    offset += len;
    return seg;
  });

  return (
    <div className="grid items-center gap-7 sm:grid-cols-[216px_1fr]">
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)" }}
          aria-hidden="true"
        >
          {segments.map((s, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={s.dasharray}
              strokeDashoffset={s.dashoffset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <div className="font-mono text-3xl font-bold text-foreground">
            {distribution.sampleSize}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            classified
          </div>
        </div>
      </div>

      <ul className="grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {entries.map((e) => (
          <li
            key={e.bucket}
            className="grid grid-cols-[12px_1fr_auto] items-center gap-2 text-[13px]"
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
