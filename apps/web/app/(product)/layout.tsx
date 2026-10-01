import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

// The shell nav renders per-request auth state (Unit 28), which depends on the
// session cookie. Render the shell dynamically so the user menu is never served
// from a stale, build-time (always-logged-out) prerender.
export const dynamic = "force-dynamic";

/**
 * Product surface: the Creator Fit tool, the admin panel, and the legal pages
 * Google's consent screen links to. Keeps the light-default app shell; the
 * agency pages under (agency) have their own dark shell (Unit 54).
 */
export default function ProductLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
