import * as React from "react";
import { AlertTriangle } from "lucide-react";
import {
  AUDIENCE_BUCKET_LABELS,
  type AudienceBucket,
  type AudienceDistribution,
} from "@kol-fit/shared";

import { cn } from "@/lib/utils";

// Buckets that drag audience quality — flagged so an analyst spots them fast.
const LOW_QUALITY = new Set<AudienceBucket>([
  "bots_spam",
  "giveaway_hunters",
  "airdrop_farmers",
]);

/** Per-bucket distribution bars, sorted by share desc. */
export function AudienceBars({
  distribution,
}: {
  distribution: AudienceDistribution;
}) {
  const entries = Object.entries(distribution.buckets).sort(
    (a, b) => (b[1]?.share ?? 0) - (a[1]?.share ?? 0)
  );

  if (distribution.sampleSize === 0 || entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No engaged accounts were sampled.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {distribution.sampleSize} engaged accounts sampled
      </p>
      <div className="space-y-2.5">
        {entries.map(([key, stats]) => {
          const bucket = key as AudienceBucket;
          const low = LOW_QUALITY.has(bucket);
          const pct = Math.round((stats?.share ?? 0) * 100);
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    low ? "text-warning" : "text-foreground"
                  )}
                >
                  {AUDIENCE_BUCKET_LABELS[bucket] ?? key}
                  {low && <AlertTriangle className="h-3 w-3" />}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {stats?.count ?? 0} · {pct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
                <div
                  className={cn(
                    "h-full rounded-full",
                    low ? "bg-warning" : "bg-accent-hover"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
