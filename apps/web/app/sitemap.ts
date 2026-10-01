import type { MetadataRoute } from "next";

import { PROJECTS } from "@/lib/agency/work";

// Public, stable pages only: the agency, its case studies, the Creator Fit
// tool's home and concierge page, and the two legal pages Google's consent
// screen points at. Report pages are per-owner and the brochure is noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://overlapx.com";
  const lastModified = new Date();

  return [
    { url: `${base}/`, lastModified, priority: 1 },
    { url: `${base}/work`, lastModified, priority: 0.9 },
    ...PROJECTS.map((p) => ({ url: `${base}/work/${p.slug}`, lastModified, priority: 0.7 })),
    { url: `${base}/pricing`, lastModified, priority: 0.8 },
    { url: `${base}/about`, lastModified, priority: 0.6 },
    { url: `${base}/contact`, lastModified, priority: 0.7 },
    { url: `${base}/creator-fit`, lastModified, priority: 0.8 },
    { url: `${base}/creator-fit/detailed`, lastModified, priority: 0.4 },
    { url: `${base}/privacy`, lastModified, priority: 0.3 },
    { url: `${base}/terms`, lastModified, priority: 0.3 },
  ];
}
