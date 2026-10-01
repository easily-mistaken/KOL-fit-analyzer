import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Poppins } from "next/font/google";

import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Wordmark typeface — a round-geometric match to the finished "overlapx" logo,
// exposed as --font-wordmark and used only by <Wordmark>. Self-hosted at build
// (no runtime request). Swap the family here if the exact logo font differs.
const wordmark = Poppins({
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
  variable: "--font-wordmark",
});

const DESCRIPTION =
  "OverlapX is a video studio for brands on X. Motion graphics, AI videos and hype edits for crypto brands, products and AI companies, delivered in 4-5 days.";

export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  title: { default: "OverlapX", template: "%s · OverlapX" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "OverlapX",
    title: "OverlapX",
    description: DESCRIPTION,
    url: "/",
  },
  // Share images come from app/opengraph-image.tsx (agency card); the
  // Creator Fit layout overrides them with the tool's own square image.
  twitter: {
    card: "summary_large_image" as const,
    title: "OverlapX",
    description: DESCRIPTION,
  },
  // Google Search Console ownership proof for overlapx.com, required before
  // Google's OAuth consent screen will accept this domain as ours. Renders as
  // <meta name="google-site-verification" …> in <head>. Google re-checks it
  // periodically, so removing this can un-verify the domain and break the
  // consent screen's brand verification.
  verification: {
    google: "xCZovrvymXIvWE3EP2V9rU1NDfuPoA_v1iRazb9SY0c",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${wordmark.variable}`}
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
        {children}
      </body>
    </html>
  );
}
