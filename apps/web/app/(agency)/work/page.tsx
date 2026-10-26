import { Section, SectionHeading } from "@/components/agency/section";
import { FilteredWorkGrid, WorkFilterNav } from "@/components/agency/work-filter";
import { FinalCta } from "@/components/agency/blocks";
import { PROJECTS } from "@/lib/agency/work";
import { pageMetadata } from "@/lib/agency/seo";

export const metadata = pageMetadata({
  title: "Work: AI films, motion graphics and hype edits · OverlapX",
  description:
    "AI films, motion graphics, hype videos and fast cuts made by OverlapX for crypto, AI and product brands on X. Each video comes with its brief and results.",
  path: "/work",
});

export default function WorkPage() {
  return (
    <>
      <Section className="pb-10 sm:pb-12">
        <SectionHeading
          as="h1"
          eyebrow="Work"
          title="Every style the timeline rewards."
          lead="Filter by style. Each project shows the brief, the video and what it did once it hit the feed."
          className="mb-10 sm:mb-12"
        />
        <WorkFilterNav />
      </Section>
      <Section className="pt-0 sm:pt-0">
        <FilteredWorkGrid projects={PROJECTS} />
      </Section>
      <FinalCta />
    </>
  );
}
