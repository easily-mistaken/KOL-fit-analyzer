import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { AppShell } from "@/components/app-shell";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata = {
  title: "OverlapX",
  description:
    "We don't measure who follows. We measure who actually listens. Audience-overlap analysis for AI and Web3 brands.",
};

// The shell nav renders per-request auth state (Unit 28), which depends on the
// session cookie. Render the shell dynamically so the user menu is never served
// from a stale, build-time (always-logged-out) prerender — notably on "/".
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Replays the stored theme onto <html> before first paint. Must stay
            inline and render-blocking, or dark readers get a white flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* Browser extensions (Grammarly, ColorZilla, …) inject attributes onto
          <body> before hydration; suppressHydrationWarning on <html> only covers
          one level, so mirror it here to silence those extension-only mismatches. */}
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
