import type { ReactNode } from "react";
import type { Viewport } from "next";

import { AgencyHeader } from "@/components/agency/agency-header";
import { AgencyFooter } from "@/components/agency/agency-footer";

// Paints the phone browser chrome (status bar, toolbar) in the page's own
// near-black instead of the default white.
export const viewport: Viewport = {
  themeColor: "#0a0c10",
  colorScheme: "dark",
};

/**
 * OverlapX agency surface (Unit 54). Always dark: data-theme on this subtree
 * makes every token resolve to its dark value regardless of the tool's
 * light/dark toggle, which keeps applying to the (product) pages only.
 */
export default function AgencyLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark" data-surface="agency" className="flex min-h-dvh flex-col bg-base text-foreground">
      <AgencyHeader />
      <main className="flex-1">{children}</main>
      <AgencyFooter />
    </div>
  );
}
