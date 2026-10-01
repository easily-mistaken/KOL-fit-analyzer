import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import { Section } from "@/components/agency/section";
import { VideoFrame } from "@/components/agency/video-frame";
import { FinalCta } from "@/components/agency/blocks";
import { PROJECTS, categoryById, projectBySlug } from "@/lib/agency/work";

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const project = projectBySlug((await params).slug);
  if (!project) return {};
  return {
    title: project.client ? `${project.title} for ${project.client}` : project.title,
    description: project.objective,
    openGraph: project.video?.poster ? { images: [project.video.poster] } : undefined,
  };
}

/** One case study: Client, Objective, Video, Result. */
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const project = projectBySlug((await params).slug);
  if (!project) notFound();

  const cat = categoryById(project.category);
  const idx = PROJECTS.indexOf(project);
  const next = PROJECTS[(idx + 1) % PROJECTS.length];

  const facts = [
    ...(project.client ? [{ label: "Client", value: project.client }] : []),
    { label: "Style", value: cat.label },
    { label: "Format", value: project.aspect },
    ...(project.durationSeconds ? [{ label: "Length", value: `${project.durationSeconds}s` }] : []),
    ...(project.year ? [{ label: "Year", value: String(project.year) }] : []),
  ];

  return (
    <>
      <Section className="pb-8 sm:pb-10">
        <Link href="/work" className="inline-flex items-center gap-2 text-sm text-secondary-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All work
        </Link>
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{cat.title}</p>
        <h1 className="mt-3 max-w-4xl text-[clamp(38px,6vw,84px)] font-semibold leading-[0.95] tracking-[-0.045em] text-foreground">
          {project.title}
        </h1>
      </Section>

      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <VideoFrame
          video={project.video}
          category={project.category}
          aspect={project.aspect}
          controls
          className={project.aspect === "9:16" ? "mx-auto max-h-[80vh] w-auto rounded-3xl border border-default" : "rounded-3xl border border-default"}
        />
      </div>

      <Section className="grid gap-12 md:grid-cols-[1fr_2fr]">
        <dl className="grid grid-cols-2 gap-6 self-start md:grid-cols-1">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{f.label}</dt>
              <dd className="mt-1 text-foreground">{f.value}</dd>
            </div>
          ))}
          {project.post ? (
            <a
              href={project.post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-ink hover:underline"
            >
              View on {project.post.platform} <ArrowUpRight className="h-4 w-4" />
            </a>
          ) : null}
        </dl>

        <div className="space-y-12">
          {project.objective ? <Block title="Objective">{project.objective}</Block> : null}
          {project.approach ? <Block title="What we made">{project.approach}</Block> : null}
          {project.metrics && project.metrics.length > 0 ? (
            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Result</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {project.metrics.map((m) => (
                  <div key={m.label} className="rounded-2xl border border-default bg-surface p-6">
                    <p className="text-4xl font-semibold tracking-[-0.04em] text-foreground">{m.value}</p>
                    <p className="mt-1 text-sm text-secondary-foreground">{m.label}</p>
                  </div>
                ))}
              </div>
              {project.metricsNote ? <p className="mt-3 text-xs text-muted-foreground">{project.metricsNote}.</p> : null}
            </div>
          ) : null}
        </div>
      </Section>

      {next && next !== project ? (
        <Section className="py-0 sm:py-0">
          <Link href={`/work/${next.slug}`} className="group flex items-center justify-between border-y border-default py-10">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Next project</span>
            <span className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {next.title}
              <ArrowUpRight className="h-6 w-6 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
            </span>
          </Link>
        </Section>
      ) : null}

      <FinalCta />
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
      <p className="mt-3 text-xl leading-relaxed tracking-tight text-foreground">{children}</p>
    </div>
  );
}
