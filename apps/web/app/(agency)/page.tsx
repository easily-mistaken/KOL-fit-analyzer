import { Hero } from "@/components/agency/hero";
import { GhostLink } from "@/components/agency/buttons";
import { Section, SectionHeading } from "@/components/agency/section";
import { WorkGrid } from "@/components/agency/work-grid";
import {
  Faq,
  FinalCta,
  PricingCards,
  ProcessSteps,
  PromiseBar,
  StyleMarquee,
  StylesGrid,
  ToolPromo,
  WhyX,
} from "@/components/agency/blocks";
import { ClientStrip, Results, Testimonials } from "@/components/agency/proof";
import { CONTACT, POSITIONING } from "@/lib/agency/content";
import { PROJECTS, featuredProjects } from "@/lib/agency/work";

// Machine-readable identity for the agency (the tool carries its own
// WebApplication JSON-LD on /creator-fit).
const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "OverlapX",
  url: "https://overlapx.com",
  description: POSITIONING.sub,
  email: CONTACT.email,
  sameAs: [CONTACT.x.url, CONTACT.linkedin, CONTACT.telegram.url],
  priceRange: "$$",
};

export default function AgencyHomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }} />
      <Hero />
      <PromiseBar />
      <ClientStrip />
      <StyleMarquee />

      {/* Until real projects exist the work grid would only repeat the style
          posters, so the styles grid stands in for it right here instead. */}
      {PROJECTS.length > 0 ? (
        <>
          <Section id="work">
            <SectionHeading
              eyebrow="Selected work"
              title="Made to be watched on mute, at speed."
              action={<GhostLink href="/work">All work</GhostLink>}
            />
            <WorkGrid projects={featuredProjects(6)} limit={6} />
          </Section>
          <WhyX />
          <StylesGrid />
        </>
      ) : (
        <>
          <StylesGrid />
          <WhyX />
        </>
      )}
      <Results />
      <ProcessSteps />

      <Section id="pricing">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple pricing. Zero risk."
          lead="Two fixed-price videos to start, and custom plans for everything else."
        />
        <PricingCards />
      </Section>

      <Testimonials />
      <ToolPromo />

      <Section id="faq" className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
        <SectionHeading eyebrow="FAQ" title="Questions, answered." className="mb-0 sm:mb-0" />
        <Faq />
      </Section>

      <FinalCta />
    </>
  );
}
