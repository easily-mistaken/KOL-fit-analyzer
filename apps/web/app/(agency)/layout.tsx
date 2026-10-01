import type { ReactNode } from "react";

import { AgencyHeader } from "@/components/agency/agency-header";
import { AgencyFooter } from "@/components/agency/agency-footer";

/**
 * OverlapX agency surface (Unit 54). Always dark: data-theme on this subtree
 * makes every token resolve to its dark value regardless of the tool's
 * light/dark toggle, which keeps applying to the (product) pages only.
 */
export default function AgencyLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark" data-surface="agency" className="flex min-h-screen flex-col bg-base text-foreground">
      <AgencyHeader />
      <main className="flex-1">{children}</main>
      <AgencyFooter />
    </div>
  );
}
