import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Reveal } from "@/components/agency/reveal";
import { VideoFrame } from "@/components/agency/video-frame";
import {
  PREVIEW_SLOTS,
  categoryById,
  type PreviewSlot,
  type Project,
  type WorkCategory,
} from "@/lib/agency/work";

/**
 * Portfolio grid. Real projects link to their case page; while the portfolio
 * is empty the grid shows PREVIEW_SLOTS, labelled as previews and unlinked, so
 * nothing on the page claims work that is not there.
 */
export function WorkGrid({
  projects,
  category,
  limit,
  className,
}: {
  projects: Project[];
  category?: WorkCategory;
  limit?: number;
  className?: string;
}) {
  const shown = category ? projects.filter((p) => p.category === category) : projects;
  const slots = PREVIEW_SLOTS.filter((s) => !category || s.category === category);

  return (
    <div className={cn("grid gap-x-6 gap-y-12 sm:grid-cols-2", className)}>
      {projects.length > 0
        ? shown.slice(0, limit).map((p, i) => (
            <Reveal key={p.slug} delay={(i % 2) * 120}>
              <ProjectCard project={p} />
            </Reveal>
          ))
        : slots.slice(0, limit).map((s, i) => (
            <Reveal key={s.key} delay={(i % 2) * 120}>
              <SlotCard slot={s} />
            </Reveal>
          ))}
      {projects.length > 0 && shown.length === 0 ? (
        <p className="text-secondary-foreground">No projects in this category yet.</p>
      ) : null}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const cat = categoryById(project.category);
  const headline = project.metrics?.[0];
  return (
    <Link href={`/work/${project.slug}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-default transition-colors group-hover:border-strong">
        <VideoFrame
          video={project.video}
          category={project.category}
          aspect="16:9"
          className="transition-transform duration-700 group-hover:scale-[1.02]"
        />
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {cat.label}
            {project.client ? ` · ${project.client}` : ""}
          </p>
          <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">{project.title}</h3>
        </div>
        {headline ? (
          <div className="text-right">
            <p className="text-xl font-semibold tracking-tight text-accent-ink">{headline.value}</p>
            <p className="text-xs text-muted-foreground">{headline.label}</p>
          </div>
        ) : (
          <ArrowUpRight className="mt-1 h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
        )}
      </div>
    </Link>
  );
}

function SlotCard({ slot }: { slot: PreviewSlot }) {
  const cat = categoryById(slot.category);
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-default">
        <VideoFrame video={null} category={slot.category} aspect="16:9" />
      </div>
      <div className="mt-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{cat.label}</p>
        <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">{cat.title}</h3>
        <p className="mt-1 text-sm text-secondary-foreground">{cat.blurb}</p>
      </div>
    </div>
  );
}
