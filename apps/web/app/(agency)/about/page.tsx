import { Reveal } from "@/components/agency/reveal";
import { Section, SectionHeading } from "@/components/agency/section";
import { FinalCta, ProcessSteps, ToolPromo, WhyX } from "@/components/agency/blocks";
import { Testimonials } from "@/components/agency/proof";
import { PROMISES } from "@/lib/agency/content";
import { pageMetadata } from "@/lib/agency/seo";

export const metadata = pageMetadata({
  title: "About OverlapX: a video studio built for X",
  description:
    "OverlapX is a video studio built for brands that market on X: crypto brands, products and AI products. Every video is made for a fast, muted timeline.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <Section>
        <SectionHeading
          as="h1"
          eyebrow="About OverlapX"
          title={
            <>
              A studio that lives on X,
              <br />
              <span className="text-secondary-foreground">making videos for brands that do too.</span>
            </>
          }
        />
        <div className="grid gap-10 md:grid-cols-2">
          <Reveal>
            <p className="text-xl leading-relaxed tracking-tight text-foreground">
              OverlapX makes videos for crypto brands, products and AI products that market themselves on X.
              We don&apos;t make one generic video and post it everywhere. We make it for a fast, muted, opinionated
              timeline, because that&apos;s where your buyers decide whether to care.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <p className="leading-relaxed text-secondary-foreground">
              The name comes from the work behind our free tool, Creator Fit: finding where a brand&apos;s audience and
              the people actually paying attention overlap. Our videos are built for that overlap. Every cut is judged
              by one question: would the right person stop scrolling for this?
            </p>
          </Reveal>
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map((p, i) => (
            <Reveal key={p.title} delay={i * 80} className="rounded-2xl border border-default bg-surface p-6">
              <p className="text-lg font-semibold tracking-tight text-foreground">{p.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-secondary-foreground">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      <WhyX />
      <Testimonials />

      <ProcessSteps />
      <ToolPromo />
      <FinalCta />
    </>
  );
}
