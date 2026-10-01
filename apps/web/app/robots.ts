import type { MetadataRoute } from "next";

// Crawlers get the public pages and nothing else. Reports live behind
// per-owner ids and the admin panel behind a password, so neither belongs in an
// index (nor does the noindex brochure). The tool home (/creator-fit) and the
// legal pages must stay crawlable: Google's OAuth review fetches them to check
// the app's name and purpose.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://overlapx.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/auth",
          "/deck",
          "/creator-fit/analyses",
          "/creator-fit/r/",
          // pre-Unit-54 paths, now redirects
          "/analyses",
          "/r/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
