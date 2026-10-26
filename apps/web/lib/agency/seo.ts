import type { Metadata } from "next";

import { alt as shareCardAlt, size as shareCardSize } from "@/app/opengraph-image";
import { CONTACT, POSITIONING } from "@/lib/agency/content";
import { PROJECTS, categoryById, type Project } from "@/lib/agency/work";

// Search and share metadata for the agency pages. A page's own `openGraph` or
// `twitter` replaces the root layout's whole object (Next merges metadata one
// key deep), so every page builds both here; otherwise a shared /pricing link
// previews as the home page with the home page's URL. That replacement also
// drops the app/opengraph-image.tsx card, so it is named explicitly.

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://overlapx.com").replace(/\/+$/, "");

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageMetadata({
  title,
  description,
  path,
  images,
}: {
  /** The full <title>, used as-is (no " · OverlapX" template). */
  title: string;
  description: string;
  path: string;
  /** Leave out for the agency share card (app/opengraph-image.tsx). */
  images?: string[];
}): Metadata {
  const shareImages = images ?? [{ url: "/opengraph-image", ...shareCardSize, alt: shareCardAlt }];
  return {
    title: { absolute: title },
    description,
    openGraph: { type: "website", siteName: "OverlapX", title, description, url: path, images: shareImages },
    twitter: { card: "summary_large_image", title, description, images: shareImages },
  };
}

/** "Sports markets go live: hype video for Outcome". */
export function projectHeadline(project: Project): string {
  const noun = categoryById(project.category).noun;
  return project.client ? `${project.title}: ${noun} for ${project.client}` : `${project.title}: ${noun}`;
}

function isoDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `PT${m ? `${m}M` : ""}${s ? `${s}S` : ""}`;
}

const ORG_ID = `${SITE_URL}/#organization`;

/** Home page: who OverlapX is, and the site name Google shows in results. */
export function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "OverlapX",
        url: `${SITE_URL}/`,
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "ProfessionalService",
        "@id": ORG_ID,
        name: "OverlapX",
        url: `${SITE_URL}/`,
        logo: absoluteUrl("/icon.svg"),
        image: absoluteUrl("/opengraph-image"),
        description: POSITIONING.sub,
        email: CONTACT.email,
        sameAs: [CONTACT.x.url, CONTACT.linkedin, CONTACT.telegram.url],
        priceRange: "$$",
        knowsAbout: ["Motion graphics", "AI video", "Hype videos", "Video editing", "X (Twitter) marketing"],
      },
    ],
  };
}

/**
 * Project page: the video itself (so it can show in Google's video results)
 * and the Home > Work > project trail. Null for a project with no footage.
 */
export function projectJsonLd(project: Project) {
  const url = absoluteUrl(`/work/${project.slug}`);
  const graph: object[] = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Work", item: absoluteUrl("/work") },
        { "@type": "ListItem", position: 3, name: project.title, item: url },
      ],
    },
  ];
  if (project.video?.poster) {
    graph.push({
      "@type": "VideoObject",
      name: projectHeadline(project),
      description: project.approach ?? project.objective ?? projectHeadline(project),
      thumbnailUrl: [absoluteUrl(project.video.poster)],
      uploadDate: project.published,
      contentUrl: project.video.src.startsWith("http") ? project.video.src : absoluteUrl(project.video.src),
      ...(project.durationSeconds ? { duration: isoDuration(project.durationSeconds) } : {}),
      url,
      creator: { "@id": ORG_ID },
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

/** Newest publish date across the portfolio, for the home and /work lastmod. */
export function latestPublished(): string | undefined {
  return PROJECTS.map((p) => p.published).sort().at(-1);
}

/** Renders JSON-LD safely inside a <script> (a "<" in any string can't close it). */
export function jsonLdHtml(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
