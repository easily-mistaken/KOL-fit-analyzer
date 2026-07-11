"use client";

import * as React from "react";
import { BadgeCheck } from "lucide-react";

import { cn } from "@/lib/utils";

// Deterministic hue from a handle so the monogram fallback is stable + varied.
function hueFromHandle(handle: string): number {
  let h = 0;
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) % 360;
  return h;
}

/**
 * Org / KOL avatar. Tries the provider-supplied image first, then an
 * avatar-by-handle lookup (so existing reports without a stored URL still show
 * a real picture), and finally falls back to a sleek gradient monogram.
 */
export function Avatar({
  handle,
  avatarUrl,
  size = 44,
  verified,
  className,
}: {
  handle: string;
  avatarUrl?: string;
  size?: number;
  verified?: boolean;
  className?: string;
}) {
  const clean = handle.replace(/^@/, "").trim();
  const candidates = React.useMemo(
    () =>
      [
        avatarUrl && /^https?:\/\//.test(avatarUrl) ? avatarUrl : null,
        clean ? `https://unavatar.io/twitter/${encodeURIComponent(clean)}` : null,
      ].filter((x): x is string => Boolean(x)),
    [avatarUrl, clean]
  );

  const [idx, setIdx] = React.useState(0);
  const exhausted = idx >= candidates.length;
  const hue = hueFromHandle(clean || "x");
  const letter = (clean.charAt(0) || "?").toUpperCase();

  return (
    <span
      className={cn(
        "relative inline-flex flex-none items-center justify-center overflow-hidden rounded-full border border-strong bg-elevated",
        className
      )}
      style={{ width: size, height: size }}
    >
      {!exhausted ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={candidates[idx]}
          src={candidates[idx]}
          alt={`@${clean}`}
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center font-semibold text-white"
          style={{
            fontSize: size * 0.42,
            background: `linear-gradient(140deg, hsl(${hue} 62% 52%), hsl(${(hue + 42) % 360} 58% 38%))`,
          }}
        >
          {letter}
        </span>
      )}
      {verified && (
        <BadgeCheck
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface text-info"
          style={{ width: size * 0.34, height: size * 0.34 }}
        />
      )}
    </span>
  );
}
