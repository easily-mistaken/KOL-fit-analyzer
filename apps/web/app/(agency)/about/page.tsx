import type { Metadata } from "next";
import Image from "next/image";

import { Reveal } from "@/components/agency/reveal";
import { Section, SectionHeading } from "@/components/agency/section";
import { FinalCta, ProcessSteps, ToolPromo, WhyX } from "@/components/agency/blocks";
import { AUDIENCES, PROMISES } from "@/lib/agency/content";
import { TEAM } from "@/lib/agency/work";

export const metadata: Metadata = {
  title: "About",
  description: "OverlapX is a video studio built for brands that market on X: crypto brands, products and AI products.",
};

export default function AboutPage() {
  return (
    <>
      <Section>
        <SectionHeading
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
              OverlapX makes videos for {AUDIENCES.map((a) => a.toLowerCase()).join(", ")} that market themselves on X.
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

      {/* Team renders only once real members are added to lib/agency/work.ts. */}
      {TEAM.length > 0 ? (
        <Section id="team">
          <SectionHeading eyebrow="Team" title="The people behind the cuts." />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((m, i) => (
              <Reveal key={m.name} delay={(i % 4) * 80}>
                <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-default bg-surface">
                  {m.photo ? (
                    <Image src={m.photo} alt={m.name} width={480} height={600} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <p className="mt-4 font-semibold text-foreground">{m.name}</p>
                <p className="text-sm text-secondary-foreground">{m.role}</p>
                {m.x ? (
                  <a href={`https://x.com/${m.x}`} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-ink hover:underline">
                    @{m.x}
                  </a>
                ) : null}
              </Reveal>
            ))}
          </div>
        </Section>
      ) : null}

      <ProcessSteps />
      <ToolPromo />
      <FinalCta />
    </>
  );
}
