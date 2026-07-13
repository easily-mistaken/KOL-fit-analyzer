import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata = {
  title: "Crypto KOL Fit Analyzer",
  description:
    "We don't just check what a KOL posts. We check who actually listens.",
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
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
