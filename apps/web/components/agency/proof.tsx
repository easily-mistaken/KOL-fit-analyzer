import Image from "next/image";

import { Reveal } from "@/components/agency/reveal";
import { Section, SectionHeading } from "@/components/agency/section";
import { CLIENTS, TESTIMONIALS, projectsWithMetrics } from "@/lib/agency/work";

// Social proof renders ONLY from real data in lib/agency/work.ts. Each block
// returns null while its list is empty, so the site never shows a fake logo,
// quote or number.

export function ClientStrip() {
  if (CLIENTS.length === 0) return null;
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-8">
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Trusted by teams shipping on X
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
        {CLIENTS.map((c) => (
          <Image
            key={c.name}
            src={c.logo}
            alt={c.name}
            width={140}
            height={40}
            className="h-8 w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
          />
        ))}
      </div>
    </div>
  );
}

export function Results() {
  const projects = projectsWithMetrics();
  if (projects.length === 0) return null;
  return (
    <Section id="results">
      <SectionHeading eyebrow="Results" title="Numbers from the timeline." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.slice(0, 6).map((p, i) => (
          <Reveal key={p.slug} delay={(i % 3) * 90} className="rounded-2xl border border-default bg-surface p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {p.client ?? "Client under NDA"}
            </p>
            <p className="mt-5 text-5xl font-semibold tracking-[-0.04em] text-foreground">{p.metrics![0]!.value}</p>
            <p className="mt-1 text-sm text-secondary-foreground">{p.metrics![0]!.label}</p>
            <p className="mt-6 text-sm text-foreground">{p.title}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export function Testimonials() {
  if (TESTIMONIALS.length === 0) return null;
  return (
    <Section id="testimonials">
      <SectionHeading eyebrow="Clients" title="What teams say." />
      <div className="grid gap-4 md:grid-cols-2">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} delay={(i % 2) * 100} className="flex flex-col rounded-2xl border border-default bg-surface p-8">
            <p className="text-xl leading-relaxed tracking-tight text-foreground">&ldquo;{t.quote}&rdquo;</p>
            <div className="mt-auto flex items-center gap-3 pt-8">
              {t.avatar ? (
                <Image src={t.avatar} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
              ) : null}
              <div>
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-sm text-muted-foreground">{t.role}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
