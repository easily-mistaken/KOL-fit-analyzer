"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { WorkGrid } from "@/components/agency/work-grid";
import {
  WORK_CATEGORIES,
  isWorkCategory,
  type Project,
  type WorkCategory,
} from "@/lib/agency/work";

// The /work style filter, read in the browser. Reading ?style= on the server
// made /work render on every request; here the page is prerendered once and
// the filter applies after load. The Suspense fallback is the unfiltered view,
// so the static HTML (and crawlers) get every project.

function useActiveStyle(): WorkCategory | undefined {
  const style = useSearchParams().get("style") ?? undefined;
  return isWorkCategory(style) ? style : undefined;
}

export function WorkFilterNav() {
  return (
    <Suspense fallback={<FilterNav active={undefined} />}>
      <FilterNavFromUrl />
    </Suspense>
  );
}

export function FilteredWorkGrid({ projects }: { projects: Project[] }) {
  return (
    <Suspense fallback={<WorkGrid projects={projects} />}>
      <GridFromUrl projects={projects} />
    </Suspense>
  );
}

function FilterNavFromUrl() {
  return <FilterNav active={useActiveStyle()} />;
}

function GridFromUrl({ projects }: { projects: Project[] }) {
  return <WorkGrid projects={projects} category={useActiveStyle()} />;
}

function FilterNav({ active }: { active: WorkCategory | undefined }) {
  return (
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
        "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors",
        active
          ? "border-accent-primary bg-accent-primary text-accent-contrast"
          : "border-strong text-secondary-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}
