import type { MetadataRoute } from "next";

// Only the pages that are public and stable: the homepage, the two legal pages
// Google's consent screen points at, and the concierge request page. Report
// pages are per-owner and deliberately absent.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://overlapx.com";
  const lastModified = new Date();

  return [
    { url: `${base}/`, lastModified, priority: 1 },
    { url: `${base}/detailed`, lastModified, priority: 0.5 },
    { url: `${base}/privacy`, lastModified, priority: 0.3 },
    { url: `${base}/terms`, lastModified, priority: 0.3 },
  ];
}
