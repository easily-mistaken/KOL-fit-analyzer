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
