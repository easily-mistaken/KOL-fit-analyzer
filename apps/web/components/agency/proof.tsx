import Image from "next/image";
import Link from "next/link";

import { Reveal } from "@/components/agency/reveal";
import { Section, SectionHeading } from "@/components/agency/section";
import { VideoFrame } from "@/components/agency/video-frame";
import { CLIENTS, TESTIMONIALS, categoryById, clientNames, spotlightProjects, type Project, type Testimonial } from "@/lib/agency/work";

// Social proof renders ONLY from real data in lib/agency/work.ts. Each block
// returns null while its list is empty, so the site never shows a fake logo,
// quote or number.

export function ClientStrip() {
  const names = clientNames();
  if (CLIENTS.length === 0 && names.length === 0) return null;
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-8">
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Videos for teams shipping on X
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
        {CLIENTS.length > 0
          ? CLIENTS.map((c) => (
              <Image
                key={c.name}
                src={c.logo}
                alt={c.name}
                width={c.width}
                height={c.height}
                // Every logo rendered solid white, so mixed brand colours read
                // as one row on the dark surface.
                style={{ height: `${1.6 * (c.scale ?? 1)}rem` }}
                className="w-auto opacity-60 brightness-0 invert transition-opacity hover:opacity-100"
              />
            ))
          : // No logo files yet: set the names as a typographic strip.
            names.map((n) => (
              <span key={n} className="text-2xl font-semibold tracking-[-0.03em] text-secondary-foreground sm:text-3xl">
                {n}
              </span>
            ))}
      </div>
    </div>
  );
}

/** The best-performing pieces, each told as a case next to its video. */
export function Results() {
  const projects = spotlightProjects();
  if (projects.length === 0) return null;
  return (
    <Section id="results">
      <SectionHeading eyebrow="Results" title="Numbers from the timeline." />
      <div className="space-y-4">
        {projects.map((p) => (
          <SpotlightCard key={p.slug} project={p} />
        ))}
      </div>
    </Section>
  );
}

function SpotlightCard({ project: p }: { project: Project }) {
  return (
    <Reveal className="grid items-center gap-8 rounded-3xl border border-default bg-surface p-5 sm:p-8 lg:grid-cols-[1.3fr_1fr]">
      <Link href={`/work/${p.slug}`} className="block overflow-hidden rounded-2xl border border-default">
        <VideoFrame video={p.video} category={p.category} aspect={p.aspect} />
      </Link>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {[p.client, categoryById(p.category).label].filter(Boolean).join(" · ")}
        </p>
        <h3 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{p.title}</h3>
        {p.objective ? <p className="mt-3 leading-relaxed text-secondary-foreground">{p.objective}</p> : null}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {p.metrics!.map((m, i) => (
            <div key={m.label} className="rounded-2xl border border-default bg-base p-4">
              <p className={i === 0 ? "text-4xl font-semibold tracking-[-0.04em] text-accent-ink" : "text-2xl font-semibold tracking-tight text-foreground"}>
                {m.value}
              </p>
              <p className="text-sm text-secondary-foreground">{m.label}</p>
            </div>
          ))}
        </div>
        {p.metricsNote ? <p className="mt-3 text-xs text-muted-foreground">{p.metricsNote}.</p> : null}
      </div>
    </Reveal>
  );
}

/**
 * Client words, shown as the chat messages they were. The thread format is the
 * point: it reads as what people actually sent, not a polished blurb.
 */
export function Testimonials() {
  if (TESTIMONIALS.length === 0) return null;
  return (
    <Section id="testimonials">
      <SectionHeading
        eyebrow="Clients"
        title="Clients come back for more."
        lead="Straight from our Telegram chats, word for word."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} delay={i * 100}>
            <ChatCard t={t} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export function ChatCard({ t }: { t: Testimonial }) {
  return (
    <figure className="flex h-full flex-col rounded-3xl border border-default bg-surface p-5">
      <figcaption className="flex items-center gap-3 border-b border-default pb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-sm font-semibold text-foreground">
          {t.name.charAt(0)}
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-foreground">{t.name}</span>
          <span className="block text-xs text-muted-foreground">{[t.role, t.company].filter(Boolean).join(", ")}</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{t.source}</span>
      </figcaption>
      <blockquote className="mt-4 flex flex-col gap-2">
        {t.messages.map((m, i) => (
          <p
            key={i}
            className="w-fit max-w-[92%] rounded-2xl rounded-bl-md bg-elevated px-4 py-2.5 text-[15px] leading-snug text-foreground"
          >
            {i === 0 ? (
              <span className="mb-0.5 block text-xs font-semibold text-accent-ink">
                {t.name} | {t.company}
              </span>
            ) : null}
            {m}
          </p>
        ))}
      </blockquote>
    </figure>
  );
}
