import type { Metadata } from "next";

import { alt as shareCardAlt, size as shareCardSize } from "@/app/opengraph-image";
import { CONTACT, FAQS, POSITIONING } from "@/lib/agency/content";
import { PROJECTS, categoryById, type Project } from "@/lib/agency/work";
import type { Service } from "@/lib/agency/services";

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
        areaServed: "Worldwide",
        // The phrases buyers (and AI assistants answering them) actually use.
        knowsAbout: [
          "Product launch videos",
          "Startup launch videos",
          "Crypto and Web3 video production",
          "AI product launch videos",
          "Motion graphics",
          "AI video production",
          "Hype videos",
          "Explainer videos",
          "Video editing",
          "X (Twitter) video marketing",
        ],
      },
      {
        // The visible FAQ, verbatim. Search engines and AI answer engines both
        // read this to answer "how much / how fast / do I pay upfront".
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}

/**
 * Service landing page: the service OverlapX offers, the Home > service trail,
 * and the page's own FAQ (verbatim from what the page shows).
 */
export function serviceJsonLd(service: Service) {
  const url = absoluteUrl(`/${service.slug}`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: service.label,
        serviceType: service.serviceType,
        description: service.metaDescription,
        url,
        // Inlined: Google does not resolve an @id that only the home page defines.
        provider: { "@type": "ProfessionalService", "@id": ORG_ID, name: "OverlapX", url: `${SITE_URL}/` },
        areaServed: "Worldwide",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: service.label, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: service.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
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
