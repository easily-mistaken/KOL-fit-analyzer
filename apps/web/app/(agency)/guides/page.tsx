import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { FinalCta, FreeResources, LaunchGalleryPromo } from "@/components/agency/blocks";
import { Reveal } from "@/components/agency/reveal";
import { Section, SectionHeading } from "@/components/agency/section";
import { GUIDES, plainText } from "@/lib/agency/guides";
import { guidesIndexJsonLd, jsonLdHtml, pageMetadata } from "@/lib/agency/seo";

export const metadata = pageMetadata({
  title: "Launch video guides for X · OverlapX",
  description:
    "Guides to launch videos on X: what performs, what a crypto launch needs, where AI video works, how to brief a studio and how to choose one.",
  path: "/guides",
});

export default function GuidesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(guidesIndexJsonLd(GUIDES)) }} />
      <Section className="pb-10 sm:pb-14">
        <SectionHeading
          as="h1"
          eyebrow="Guides"
          title="Launch videos for X, explained."
          lead="What we have learned making launch videos for crypto brands, startups and AI products: what performs on the timeline, what to make, how to brief it and how to choose a studio."
          className="mb-0 sm:mb-0"
        />
      </Section>
      <Section className="pt-0 sm:pt-0">
        <ul className="grid gap-4 md:grid-cols-2">
          {GUIDES.map((g, i) => (
            <Reveal as="li" key={g.slug} delay={(i % 2) * 90}>
              <Link
                href={`/guides/${g.slug}`}
                className="group flex h-full flex-col rounded-3xl border border-default bg-surface p-7 transition-colors hover:bg-elevated"
              >
                <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground">{g.title}</h2>
                <p className="mt-3 line-clamp-4 leading-relaxed text-secondary-foreground">{plainText(g.summary)}</p>
                <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-medium text-accent-ink">
                  Read the guide
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </Section>
      <LaunchGalleryPromo />
      <FreeResources items={["idea", "creatorFit"]} />
      <FinalCta />
    </>
  );
}
