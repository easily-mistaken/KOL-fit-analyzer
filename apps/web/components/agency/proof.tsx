import Image from "next/image";
import Link from "next/link";

import { Reveal } from "@/components/agency/reveal";
import { Section, SectionHeading } from "@/components/agency/section";
import { VideoFrame } from "@/components/agency/video-frame";
import { CLIENTS, TESTIMONIALS, categoryById, clientNames, spotlightProject } from "@/lib/agency/work";

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
                width={140}
                height={40}
                className="h-8 w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
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

/** One project's numbers, told as a case study next to its video. */
export function Results() {
  const p = spotlightProject();
  if (!p) return null;
  return (
    <Section id="results">
      <SectionHeading eyebrow="Results" title="Numbers from the timeline." />
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
