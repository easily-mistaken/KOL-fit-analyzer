import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Fades its children up as they scroll into view. Pure CSS (a scroll-driven
 * animation in globals.css), so it ships no JavaScript and content is visible
 * from the first paint: the earlier JS version kept every wrapped heading at
 * opacity 0 until hydration, which on a phone pushed the page's main text
 * (Largest Contentful Paint) out by 4-5 seconds. Browsers without scroll-driven
 * animations, and reduced-motion readers, simply show the content.
 *
 * `delay` (ms) staggers siblings by starting their fade a little later in the
 * scroll; `as="li"` keeps lists valid when the item itself reveals.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li";
}) {
  return (
    <Tag
      className={cn("reveal", className)}
      style={delay ? ({ "--reveal-shift": `${Math.min(delay / 10, 30)}%` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
