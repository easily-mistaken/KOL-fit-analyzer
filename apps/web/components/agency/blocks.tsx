import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { BookCallButton, GhostLink } from "@/components/agency/buttons";
import { Reveal } from "@/components/agency/reveal";
import { Section, SectionHeading } from "@/components/agency/section";
import { CONTACT, FAQS, PRICING_FACTORS, PROCESS, PROMISES, TURNAROUND, WHY_X } from "@/lib/agency/content";
import { PROJECTS, WORK_CATEGORIES } from "@/lib/agency/work";
import { VideoFrame } from "@/components/agency/video-frame";

const STYLE_WORDS = [
  "Motion graphics",
  "AI films",
  "Hype videos",
  "Fast cuts",
  "Launch videos",
  "Product walkthroughs",
  "Explainers",
  "Event promos",
];

export function StyleMarquee() {
  return (
    <div className="overflow-hidden border-y border-default py-5" aria-label="Video styles">
      <div className="marquee-track flex w-max">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
            {STYLE_WORDS.map((w) => (
              <span key={w} className="flex items-center whitespace-nowrap text-[clamp(22px,3vw,36px)] font-semibold tracking-tight text-foreground">
                <span className="px-8">{w}</span>
                <span className="h-2.5 w-2.5 rotate-45 bg-accent-primary" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PromiseBar() {
  return (
    <div className="mx-auto grid max-w-7xl gap-px overflow-hidden px-4 sm:px-8 md:grid-cols-4">
      {PROMISES.map((p, i) => (
        <Reveal key={p.title} delay={i * 80} className="border-default py-7 pr-4 max-md:border-t max-md:first:border-t-0 md:border-l md:py-8 md:pl-6 md:first:border-l-0 md:first:pl-0">
          <p className="text-lg font-semibold tracking-tight text-foreground">{p.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-secondary-foreground">{p.body}</p>
        </Reveal>
      ))}
    </div>
  );
}

function projectCount(category: string): string {
  const n = PROJECTS.filter((p) => p.category === category).length;
  return n === 0 ? "New" : `${n} project${n === 1 ? "" : "s"}`;
}

export function StylesGrid() {
  return (
    <Section id="styles">
      <SectionHeading
        eyebrow="What we make"
        title="One studio, every style the timeline rewards."
        lead="Pick a style, or tell us the moment you're building toward and we'll pick it with you."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {WORK_CATEGORIES.map((c, i) => (
          <Reveal key={c.id} delay={(i % 3) * 90} className={cn(i === 0 && "lg:col-span-2")}>
            <Link
              href={`/work?style=${c.id}`}
              className="group relative flex h-full min-h-[300px] flex-col justify-end overflow-hidden rounded-2xl border border-default"
            >
              {/* A real piece from the category when there is one, else its poster animation. */}
              <VideoFrame
                video={PROJECTS.find((p) => p.category === c.id && p.video)?.video ?? null}
                category={c.id}
                fill
                className="opacity-60 transition-opacity duration-500 group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-base via-base/60 to-transparent" />
              <div className="relative p-6">
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-strong bg-base/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-secondary-foreground">
                    {/* No prices on the home page (user, 2026-10-02): the tag shows
                        how much of that style is in the portfolio instead. */}
                    {projectCount(c.id)}
                  </span>
                  <ArrowUpRight className="h-5 w-5 text-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{c.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-secondary-foreground">{c.blurb}</p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export function WhyX() {
  return (
    <Section id="why-x">
      <SectionHeading
        eyebrow="Why X"
        title={
          <>
            X isn&apos;t YouTube.
            <br />
            <span className="text-secondary-foreground">We edit for the scroll.</span>
          </>
        }
        lead="Most studios make one video and post it everywhere. We make it for the place your buyers actually are: a fast, muted, opinionated timeline."
      />
      <div className="grid gap-px overflow-hidden rounded-2xl border border-default bg-default sm:grid-cols-2">
        {WHY_X.map((w, i) => (
          <Reveal key={w.title} delay={(i % 2) * 100} className="bg-base p-8 sm:p-10">
            <span className="font-mono text-sm text-accent-ink">0{i + 1}</span>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{w.title}</h3>
            <p className="mt-3 max-w-md leading-relaxed text-secondary-foreground">{w.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export function ProcessSteps() {
  return (
    <Section id="process">
      <SectionHeading
        eyebrow="Process"
        title={
          <>
            From call to final cut in <span className="whitespace-nowrap">{TURNAROUND}</span>.
          </>
        }
        lead="No retainers to sign and no deposit to wire. You see the idea early, we refine until it's perfect, and you pay at the end."
      />
      <ol className="grid gap-4 md:grid-cols-5">
        {PROCESS.map((s, i) => (
          <Reveal key={s.title} delay={i * 90}>
            <li className="flex h-full flex-col rounded-2xl border border-default bg-surface p-6">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full font-mono text-sm",
                  i === PROCESS.length - 1 ? "bg-accent-primary text-accent-contrast" : "bg-elevated text-foreground"
                )}
              >
                {i + 1}
              </span>
              <h3 className="mt-6 text-lg font-semibold tracking-tight text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-secondary-foreground">{s.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}

/** How a quote is built: the factors, then what is the same on every project. */
export function PricingFactors() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRICING_FACTORS.map((f, i) => (
          <Reveal key={f.title} delay={i * 90} className="flex h-full flex-col rounded-3xl border border-default bg-surface p-7">
            <span className="font-mono text-sm text-accent-ink">0{i + 1}</span>
            <h3 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-secondary-foreground">{f.body}</p>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-4 grid gap-8 rounded-3xl bg-accent-primary p-8 text-accent-contrast sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[0.16em] opacity-70">On every project</p>
          <p className="mt-3 text-3xl font-semibold leading-tight tracking-tight">
            You see the quote before we start, and you pay only when you love the video.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PROMISES.map((p) => (
            <li key={p.title} className="flex items-start gap-2.5 text-[15px] font-medium">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              {p.title}
            </li>
          ))}
        </ul>
      </Reveal>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <BookCallButton size="lg" label="Get a quote" />
        <GhostLink href={CONTACT.telegram.url} size="lg" external>
          Message on Telegram
        </GhostLink>
      </div>
    </>
  );
}

export function Faq() {
  return (
    <div className="divide-y divide-default border-y border-default">
      {FAQS.map((f) => (
        <details key={f.q} className="group py-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium tracking-tight text-foreground [&::-webkit-details-marker]:hidden">
            {f.q}
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-strong text-xl leading-none transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-3 max-w-2xl leading-relaxed text-secondary-foreground">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function ToolPromo() {
  return (
    <Section>
      <Reveal className="grid items-center gap-10 overflow-hidden rounded-3xl border border-default bg-surface p-8 sm:p-12 md:grid-cols-[1.3fr_1fr]">
        <div>
          <span className="rounded-full bg-elevated px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-accent-ink">
            Free tool
          </span>
          <h2 className="mt-5 text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.02] tracking-[-0.03em] text-balance text-foreground">
            Paying a creator to post your video? Check who actually listens first.
          </h2>
          <p className="mt-4 max-w-lg leading-relaxed text-pretty text-secondary-foreground">            Creator Fit reads the accounts that really engage with an X creator and scores how well that audience
            matches the people you want to reach.
          </p>
          <GhostLink href="/creator-fit" className="mt-7">
            Try Creator Fit <ArrowRight className="h-4 w-4" />
          </GhostLink>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[280px]">
          <div className="absolute inset-0 rounded-full border-2 border-strong" style={{ transform: "translateX(-18%)" }} />
          <div className="absolute inset-0 rounded-full border-2 border-accent-primary" style={{ transform: "translateX(18%)" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-accent-primary px-3 py-1 font-mono text-xs font-semibold text-accent-contrast">overlap</span>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

export function FinalCta() {
  return (
    <Section className="pb-28">
      <Reveal className="relative overflow-hidden rounded-[32px] border border-default bg-surface px-6 py-16 text-center sm:px-12 sm:py-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-primary/20 blur-[100px]" />
        <h2 className="relative mx-auto max-w-4xl text-[clamp(36px,6vw,84px)] font-semibold leading-[0.95] tracking-[-0.045em] text-balance text-foreground">
          Make your next launch impossible to scroll past.
        </h2>
        <p className="relative mx-auto mt-6 max-w-xl text-lg text-secondary-foreground">
          One short call. A video in {TURNAROUND}. Pay only when you love it.
        </p>
        <div className="relative mt-10 flex flex-wrap justify-center gap-3">
          <BookCallButton size="lg" />
          <GhostLink href={CONTACT.x.url} size="lg" external>
            DM on X
          </GhostLink>
          <GhostLink href={CONTACT.telegram.url} size="lg" external>
            Telegram
          </GhostLink>
        </div>
      </Reveal>
    </Section>
  );
}
