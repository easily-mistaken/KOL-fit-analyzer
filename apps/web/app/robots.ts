import type { MetadataRoute } from "next";

// Crawlers get the public pages and nothing else. Reports live behind
// per-owner ids and the admin panel behind a password, so neither belongs in an
// index — but the homepage and the legal pages must be freely crawlable, since
// Google's OAuth review fetches them to check the app's name and purpose.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://overlapx.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/analyses", "/auth", "/r/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
