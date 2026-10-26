import { Hero } from "@/components/agency/hero";
import { GhostLink } from "@/components/agency/buttons";
import { Section, SectionHeading } from "@/components/agency/section";
import { WorkGrid } from "@/components/agency/work-grid";
import {
  Faq,
  FinalCta,
  ProcessSteps,
  PromiseBar,
  StyleMarquee,
  StylesGrid,
  ToolPromo,
  WhyX,
} from "@/components/agency/blocks";
import { ClientStrip, Results, Testimonials } from "@/components/agency/proof";
import { PROJECTS, featuredProjects } from "@/lib/agency/work";
import { homeJsonLd, jsonLdHtml, pageMetadata } from "@/lib/agency/seo";

export const metadata = pageMetadata({
  title: "OverlapX: AI films and motion graphics for brands on X",
  description:
    "OverlapX is a video studio for brands on X. Motion graphics, AI videos and hype edits for crypto brands, products and AI companies, delivered in 4-5 days.",
  path: "/",
});

export default function AgencyHomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(homeJsonLd()) }} />
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
      <Testimonials />
      <ProcessSteps />

      <ToolPromo />

      <Section id="faq" className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
        <SectionHeading eyebrow="FAQ" title="Questions, answered." className="mb-0 self-start sm:mb-0 md:sticky md:top-24" />
        <Faq />
      </Section>

      <FinalCta />
    </>
  );
}
