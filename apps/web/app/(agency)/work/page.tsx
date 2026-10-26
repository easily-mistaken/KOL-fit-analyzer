import type { Metadata } from "next";

import { Section, SectionHeading } from "@/components/agency/section";
import { FilteredWorkGrid, WorkFilterNav } from "@/components/agency/work-filter";
import { FinalCta } from "@/components/agency/blocks";
import { PROJECTS } from "@/lib/agency/work";

export const metadata: Metadata = {
  title: "Work",
  description: "AI films, motion graphics, hype videos and fast cuts made by OverlapX for brands on X.",
};

export default function WorkPage() {
  return (
    <>
      <Section className="pb-10 sm:pb-12">
        <SectionHeading
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
