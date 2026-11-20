import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BookCallButton, GhostLink } from "@/components/agency/buttons";
import { Faq, FinalCta, LaunchGalleryPromo, ProcessSteps } from "@/components/agency/blocks";
import { Reveal } from "@/components/agency/reveal";
import { Section, SectionHeading } from "@/components/agency/section";
import { WorkGrid } from "@/components/agency/work-grid";
import { SERVICES, serviceProjects, type Service } from "@/lib/agency/services";
import { jsonLdHtml, serviceJsonLd } from "@/lib/agency/seo";

/**
 * One service landing page (Unit 55): what we make, the work that proves it,
 * why it works on X, the process, a page-specific FAQ, and links to the other
 * services. Everything renders from lib/agency/services.ts.
 */
export function ServicePage({ service }: { service: Service }) {
  const others = SERVICES.filter((s) => s.slug !== service.slug);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(serviceJsonLd(service)) }} />

      <Section className="pb-10 sm:pb-14">
        <SectionHeading as="h1" eyebrow={service.eyebrow} title={service.title} lead={service.lead} className="mb-8 sm:mb-10" />
        <Reveal className="flex flex-wrap gap-3">
          <BookCallButton size="lg" />
          <GhostLink href="/work" size="lg">
            See all work
          </GhostLink>
        </Reveal>
      </Section>

      <Section className="pt-0 sm:pt-0">
        <SectionHeading eyebrow="What we make" title={service.offersTitle} className="mb-8 sm:mb-10" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {service.offers.map((o, i) => (
            <Reveal key={o.title} delay={i * 90} className="flex h-full flex-col rounded-3xl border border-default bg-surface p-7">
              <span className="font-mono text-sm text-accent-ink">0{i + 1}</span>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{o.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-secondary-foreground">{o.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="The work"
          title="Made by OverlapX."
          lead="Each project opens with its brief, the full video and what it did once it hit the feed."
          action={<GhostLink href="/work">All work</GhostLink>}
        />
        <WorkGrid projects={serviceProjects(service)} />
      </Section>

      <Section>
        <SectionHeading eyebrow="Why it works" title="Built for how X is watched." className="mb-8 sm:mb-10" />
        <div className="grid gap-x-10 gap-y-8 border-t border-default pt-8 md:grid-cols-2">
          {service.points.map((p, i) => (
            <Reveal key={p.title} delay={(i % 2) * 90}>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">{p.title}</h3>
              <p className="mt-2 max-w-lg leading-relaxed text-secondary-foreground">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {service.references ? <LaunchGalleryPromo /> : null}

      <ProcessSteps />

      <Section className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
        <SectionHeading eyebrow="FAQ" title="Questions, answered." className="mb-0 self-start sm:mb-0 md:sticky md:top-24" />
        <Faq items={service.faqs} />
      </Section>

      <Section className="py-8 sm:py-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Also from OverlapX</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {others.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/${s.slug}`}
                className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-default px-5 py-4 text-foreground transition-colors hover:bg-elevated"
              >
                <span className="font-medium">{s.label}</span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <FinalCta />
    </>
  );
}
