import type { MetadataRoute } from "next";

import { PROJECTS, categoryById } from "@/lib/agency/work";
import { SITE_URL, absoluteUrl, latestPublished, projectHeadline } from "@/lib/agency/seo";

// Public, stable pages only: the agency, its case studies, the Creator Fit
// tool's home and concierge page, and the two legal pages Google's consent
// screen points at. Report pages are per-owner and the brochure is noindex.
//
// lastmod is only set where it is true: a case study's publish date, and the
// newest of those for the pages that list them. A build-time "now" on every
// URL would tell Google everything changed on each deploy, and Google stops
// trusting a sitemap's lastmod once it learns it is noise. Each case study
// also lists its video, so Google can find it for video results.
export default function sitemap(): MetadataRoute.Sitemap {
  const newestWork = latestPublished();

  return [
    { url: `${SITE_URL}/`, lastModified: newestWork, priority: 1 },
    { url: `${SITE_URL}/work`, lastModified: newestWork, priority: 0.9 },
    ...PROJECTS.map((p) => ({
      url: absoluteUrl(`/work/${p.slug}`),
      lastModified: p.published,
      priority: 0.7,
      ...(p.video?.poster
        ? {
            videos: [
              {
                title: projectHeadline(p),
                thumbnail_loc: absoluteUrl(p.video.poster),
                description: p.approach ?? p.objective ?? categoryById(p.category).title,
                content_loc: p.video.src.startsWith("http") ? p.video.src : absoluteUrl(p.video.src),
                ...(p.durationSeconds ? { duration: p.durationSeconds } : {}),
                publication_date: p.published,
              },
            ],
          }
        : {}),
    })),
    { url: `${SITE_URL}/pricing`, priority: 0.8 },
    { url: `${SITE_URL}/about`, priority: 0.6 },
    { url: `${SITE_URL}/contact`, priority: 0.7 },
    { url: `${SITE_URL}/creator-fit`, priority: 0.8 },
    { url: `${SITE_URL}/creator-fit/detailed`, priority: 0.4 },
    { url: `${SITE_URL}/privacy`, priority: 0.3 },
    { url: `${SITE_URL}/terms`, priority: 0.3 },
  ];
}
