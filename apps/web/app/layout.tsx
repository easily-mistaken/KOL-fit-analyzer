import type { ReactNode } from "react";
import localFont from "next/font/local";
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

// Geist (OFL), same files and settings as the `geist` package's GeistSans /
// GeistMono, but subset to Latin (incl. Latin Extended A/B for creator names)
// with pyftsubset: each drops from ~70 KB to ~40 KB. Characters outside the
// subset fall back to the system font glyph by glyph. Regenerate from
// node_modules/geist/dist/fonts/*/…-Variable.woff2 with
// --unicodes="U+0000-024F,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,
// U+20AC,U+2122,U+2190-21FF,U+2212,U+2215,U+25A0-25FF,U+2713,U+2715"
// --layout-features='*' --flavor=woff2 if the package is ever upgraded.
const geistSans = localFont({
  src: "./fonts/Geist-Variable.latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

// Mono only sets the small uppercase eyebrow labels, so it is not preloaded:
// it no longer competes with the hero image for the first second on a phone,
// and the labels swap in from ui-monospace once it lands.
const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Roboto Mono", "Menlo", "Monaco", "Liberation Mono", "DejaVu Sans Mono", "Courier New", "monospace"],
});

const DESCRIPTION =
  "OverlapX is a video studio for brands on X. Motion graphics, AI videos and hype edits for crypto brands, products and AI companies, delivered in 4-5 days.";

export const metadata = {
  // Falls back to the real domain, not localhost: this base builds every
  // canonical URL, so a build missing NEXT_PUBLIC_APP_URL must still tell
  // Google the right host.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://overlapx.com"
  ),
  title: { default: "OverlapX", template: "%s · OverlapX" },
  description: DESCRIPTION,
  // Every page names its own non-www URL as canonical ("./" resolves to the
  // page's path against metadataBase). www.overlapx.com also 301s here in
  // nginx; without both, Google treated the two hosts as duplicates and
  // indexed www instead of the real home page.
  alternates: { canonical: "./" },
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
      className={`${geistSans.variable} ${geistMono.variable} ${wordmark.variable}`}
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
