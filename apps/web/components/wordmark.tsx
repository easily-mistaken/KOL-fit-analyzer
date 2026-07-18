import { cn } from "@/lib/utils";

/**
 * "overlapx" wordmark — the lowercase, geometric logotype that sits beside the
 * <LogoMark>. Set in --font-wordmark (a round-geometric match to the finished
 * logo, loaded in layout.tsx; swap the family there for the exact typeface).
 *
 * Colour is inherited (callers pass a text-* class), so it stays theme-aware on
 * both the light and dark surfaces — mirroring how the mark recolours. Kept as
 * live text (not an image) so it's crisp at every size and needs no asset.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-wordmark)] font-semibold lowercase tracking-tight",
        className
      )}
    >
      overlapx
    </span>
  );
}
