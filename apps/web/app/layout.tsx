import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";

import { AppShell } from "@/components/app-shell";
import "./globals.css";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "Crypto KOL Fit Analyzer",
  description:
    "We don't just check what a KOL posts. We check who actually listens.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
