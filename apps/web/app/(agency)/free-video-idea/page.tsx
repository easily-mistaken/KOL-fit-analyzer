import { FinalCta } from "@/components/agency/blocks";
import { FreeIdeaSection } from "@/components/agency/free-idea-section";
import { GhostLink } from "@/components/agency/buttons";
import { Section, SectionHeading } from "@/components/agency/section";
import { WorkGrid } from "@/components/agency/work-grid";
import { featuredProjects } from "@/lib/agency/work";
import { pageMetadata } from "@/lib/agency/seo";

export const metadata = pageMetadata({
  title: "Get a free launch video idea · OverlapX",
  description:
    "Tell us what you're launching and your budget, and OverlapX sends you a free video idea for your X launch. No call needed, about 20 seconds.",
  path: "/free-video-idea",
});

/** The free video idea offer (Unit 57), mirroring launchgallery.video. */
export default function FreeVideoIdeaPage() {
  return (
    <>
      <FreeIdeaSection source="free_idea_page" headingLevel="h1" crossLinks />
      <Section>
        <SectionHeading
          eyebrow="Our work"
          title="Ideas we made real."
          action={<GhostLink href="/work">All work</GhostLink>}
        />
        <WorkGrid projects={featuredProjects(4)} limit={4} />
      </Section>
      <FinalCta />
    </>
  );
}
