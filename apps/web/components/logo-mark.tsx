import { cn } from "@/lib/utils";

/**
 * OverlapX mark: two audiences intersecting; the filled lens is the engaged
 * overlap the product measures.
 *
 * Inlined (rather than an <img src="/logo.svg">) so it can pick up the theme via
 * currentColor. It renders in --logo-mark — the exact lime the mark was designed
 * in on dark, and a deeper, legible green on the near-white light surfaces where
 * pure lime washes out. Callers pass sizing via height/width classes; the color
 * is built in.
 *
 * The static twin at app/icon.svg (browser-tab favicon, which must be a real
 * file) has to be updated by hand if this mark ever changes.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="OverlapX"
      className={cn("text-logo-mark", className)}
    >
      <circle cx="12.5" cy="16" r="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="19.5" cy="16" r="8" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16 8.94a8 8 0 0 0 0 14.12A8 8 0 0 0 16 8.94Z"
        fill="currentColor"
      />
    </svg>
  );
}
