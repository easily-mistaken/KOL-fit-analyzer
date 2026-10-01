import type { Metadata } from "next";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Section, SectionHeading } from "@/components/agency/section";
import { WorkGrid } from "@/components/agency/work-grid";
import { FinalCta } from "@/components/agency/blocks";
import { PROJECTS, WORK_CATEGORIES, isWorkCategory } from "@/lib/agency/work";

export const metadata: Metadata = {
  title: "Work",
  description: "AI films, motion graphics, hype videos and fast cuts made by OverlapX for brands on X.",
};

export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string }>;
}) {
  const { style } = await searchParams;
  const active = isWorkCategory(style) ? style : undefined;

  return (
    <>
      <Section className="pb-10 sm:pb-12">
        <SectionHeading
          eyebrow="Work"
          title="Every style the timeline rewards."
          lead="Filter by style. Each project shows the brief, the video and what it did once it hit the feed."
          className="mb-10 sm:mb-12"
        />
        <nav className="flex flex-wrap gap-2" aria-label="Filter by style">
          <FilterChip href="/work" active={!active}>
            All
          </FilterChip>
          {WORK_CATEGORIES.map((c) => (
            <FilterChip key={c.id} href={`/work?style=${c.id}`} active={active === c.id}>
              {c.label}
            </FilterChip>
          ))}
        </nav>
      </Section>
      <Section className="pt-0 sm:pt-0">
        <WorkGrid projects={PROJECTS} category={active} />
      </Section>
      <FinalCta />
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition-colors",
        active
          ? "border-accent-primary bg-accent-primary text-accent-contrast"
          : "border-strong text-secondary-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}
