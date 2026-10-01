import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import { Download } from "lucide-react";

import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo-mark";
import { Wordmark } from "@/components/wordmark";
import { MotionPoster } from "@/components/agency/motion-poster";
import {
  AUDIENCES,
  CONTACT,
  POSITIONING,
  PROCESS,
  PROMISES,
  TURNAROUND,
  WHY_X,
} from "@/lib/agency/content";
import {
  CLIENTS,
  PROJECTS,
  PREVIEW_SLOTS,
  TESTIMONIALS,
  WORK_CATEGORIES,
  categoryById,
  featuredProjects,
  clientNames,
  spotlightProjects,
} from "@/lib/agency/work";

// ============================================================================
// OverlapX brochure (Unit 54). Built from the same data as the site, so turnaround,
// work and contact can never drift between the two. It shows no prices. Each <Slide> is a
// 16:9 page; sizes are in cqw (percent of slide width), so a slide looks the
// same scaled into a browser window and printed at 1920x1080.
//
// PDF: run the dev/prod server, then `node scripts/export-deck.mjs`, which
// prints this page with headless Chrome to apps/web/public/overlapx-deck.pdf.
// Proof slides (clients, results, testimonials, team) appear only once their
// data exists in lib/agency/work.ts.
// ============================================================================

export const metadata: Metadata = {
  title: "Brochure",
  robots: { index: false, follow: false },
};

const SITE = "overlapx.com";

export default function DeckPage() {
  const featured = featuredProjects(4);
  const spotlights = spotlightProjects();
  const clients = clientNames();
  const slides: ReactNode[] = [
    <CoverSlide key="cover" />,
    <WhatSlide key="what" />,
    <WhyXSlide key="why" />,
    <StylesSlide key="styles" />,
    <WorkSlide key="work" featured={featured} />,
    CLIENTS.length > 0 || clients.length > 0 ? <ClientsSlide key="clients" names={clients} /> : null,
    ...spotlights.map((p) => <ResultsSlide key={`results-${p.slug}`} project={p} />),
    <ProcessSlide key="process" />,
    <WhyUsSlide key="why-us" />,
    TESTIMONIALS.length > 0 ? <TestimonialsSlide key="testimonials" /> : null,
    <StartSlide key="start" />,
  ].filter(Boolean);

  return (
    <div data-theme="dark" data-surface="deck" className="min-h-screen bg-base text-foreground">
      <div className="deck-chrome sticky top-0 z-10 flex items-center justify-between border-b border-default bg-base/90 px-4 py-3 backdrop-blur sm:px-8">
        <span className="flex items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <Wordmark className="text-[16px] text-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Brochure</span>
        </span>
        <a
          href="/overlapx-deck.pdf"
          download
          className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-4 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover"
        >
          <Download className="h-4 w-4" /> PDF
        </a>
      </div>
      <div className="mx-auto max-w-[1280px] space-y-6 px-4 py-8 sm:px-8 print:max-w-none print:space-y-0 print:p-0">
        {slides.map((s, i) => (
          <SlideFrame key={i} n={i + 1} total={slides.length}>
            {s}
          </SlideFrame>
        ))}
      </div>
    </div>
  );
}

// ---------- slide frame ----------

function SlideFrame({ n, total, children }: { n: number; total: number; children: ReactNode }) {
  return (
    <div className="deck-slide relative aspect-video w-full overflow-hidden rounded-2xl border border-default bg-base [container-type:inline-size] print:border-0">
      {children}
      <div className="absolute inset-x-[4cqw] bottom-[2.4cqw] flex items-center justify-between text-[0.9cqw] text-muted-foreground">
        <span className="flex items-center gap-[0.5cqw]">
          <LogoMark className="h-[1.4cqw] w-[1.4cqw]" />
          <span className="font-mono uppercase tracking-[0.18em]">OverlapX</span>
        </span>
        <span className="font-mono">
          {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

function Pad({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("absolute inset-0 flex flex-col px-[4cqw] pb-[6cqw] pt-[4cqw]", className)}>{children}</div>;
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-[0.6cqw] font-mono text-[0.95cqw] uppercase tracking-[0.2em] text-secondary-foreground">
      <span className="h-[0.5cqw] w-[0.5cqw] bg-accent-primary" />
      {children}
    </span>
  );
}

function Title({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn("mt-[1.4cqw] text-[4.4cqw] font-semibold leading-[0.98] tracking-[-0.04em] text-foreground", className)}>
      {children}
    </h2>
  );
}

// ---------- slides ----------

function CoverSlide() {
  return (
    <Pad className="justify-between">
      <div className="pointer-events-none absolute -right-[10cqw] -top-[10cqw] h-[40cqw] w-[40cqw] rounded-full bg-accent-primary/15 blur-[8cqw]" />
      <span className="relative flex items-center gap-[1cqw]">
        <LogoMark className="h-[3.2cqw] w-[3.2cqw]" />
        <Wordmark className="text-[3cqw] text-foreground" />
      </span>
      <div className="relative">
        <Kicker>{POSITIONING.eyebrow}</Kicker>
        <h1 className="mt-[1.6cqw] max-w-[70cqw] text-[7.6cqw] font-semibold leading-[1.02] tracking-[-0.05em] text-foreground">
          Videos made for the{" "}
          <span className="rounded-[0.6cqw] bg-accent-primary px-[0.6cqw] text-accent-contrast">X timeline.</span>
        </h1>
        <p className="mt-[2cqw] text-[1.5cqw] text-secondary-foreground">
          For {AUDIENCES.join(" · ")} · {SITE}
        </p>
      </div>
    </Pad>
  );
}

function WhatSlide() {
  return (
    <Pad>
      <Kicker>What OverlapX is</Kicker>
      <div className="mt-[2cqw] grid flex-1 grid-cols-[1.2fr_1fr] gap-[4cqw]">
        <div>
          <Title>A video studio for brands that market on X.</Title>
          <p className="mt-[2cqw] max-w-[44cqw] text-[1.55cqw] leading-relaxed text-secondary-foreground">{POSITIONING.sub}</p>
        </div>
        <div className="grid grid-cols-2 content-center gap-[1.2cqw]">
          {PROMISES.map((p) => (
            <div key={p.title} className="rounded-[1.2cqw] border border-default bg-surface p-[1.8cqw]">
              <p className="text-[1.5cqw] font-semibold tracking-tight text-foreground">{p.title}</p>
              <p className="mt-[0.6cqw] text-[1.05cqw] leading-relaxed text-secondary-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </Pad>
  );
}

function WhyXSlide() {
  return (
    <Pad>
      <Kicker>Why X</Kicker>
      <Title>
        X isn&apos;t YouTube. <span className="text-secondary-foreground">We edit for the scroll.</span>
      </Title>
      <div className="mt-auto grid grid-cols-4 gap-[1.2cqw]">
        {WHY_X.map((w, i) => (
          <div key={w.title} className="rounded-[1.2cqw] border border-default bg-surface p-[1.8cqw]">
            <span className="font-mono text-[1.1cqw] text-accent-ink">0{i + 1}</span>
            <p className="mt-[1cqw] text-[1.6cqw] font-semibold leading-tight tracking-tight text-foreground">{w.title}</p>
            <p className="mt-[0.8cqw] text-[1.05cqw] leading-relaxed text-secondary-foreground">{w.body}</p>
          </div>
        ))}
      </div>
    </Pad>
  );
}

function StylesSlide() {
  return (
    <Pad>
      <Kicker>What we make</Kicker>
      <Title>Every style the timeline rewards.</Title>
      <div className="mt-auto grid grid-cols-5 gap-[1cqw]">
        {WORK_CATEGORIES.map((c) => (
          <div key={c.id} className="overflow-hidden rounded-[1.2cqw] border border-default bg-surface">
            <StylePoster category={c.id} />
            <div className="p-[1.3cqw]">
              <p className="font-mono text-[0.85cqw] uppercase tracking-[0.16em] text-accent-ink">{projectCount(c.id)}</p>
              <p className="mt-[0.5cqw] text-[1.45cqw] font-semibold tracking-tight text-foreground">{c.title}</p>
              <p className="mt-[0.5cqw] text-[0.95cqw] leading-relaxed text-secondary-foreground">{c.blurb}</p>
            </div>
          </div>
        ))}
      </div>
    </Pad>
  );
}

/** Portfolio depth per style. The brochure shows no prices (user, 2026-10-02). */
function projectCount(category: string): string {
  const n = PROJECTS.filter((p) => p.category === category).length;
  return n === 0 ? "New" : `${n} project${n === 1 ? "" : "s"}`;
}

/** A real poster from the category when one exists, else its animation. */
function StylePoster({ category }: { category: (typeof WORK_CATEGORIES)[number]["id"] }) {
  const poster = PROJECTS.find((p) => p.category === category && p.video?.poster)?.video?.poster;
  return poster ? (
    <div className="relative aspect-[4/3]">
      <Image src={poster} alt="" fill className="object-cover" />
    </div>
  ) : (
    <MotionPoster category={category} className="aspect-[4/3]" />
  );
}

function WorkSlide({ featured }: { featured: ReturnType<typeof featuredProjects> }) {
  const tiles =
    featured.length > 0
      ? featured.map((p) => ({
          key: p.slug,
          category: p.category,
          poster: p.video?.poster,
          title: p.title,
          sub: [categoryById(p.category).label, p.client].filter(Boolean).join(" · "),
          href: `https://${SITE}/work/${p.slug}`,
        }))
      : PREVIEW_SLOTS.slice(0, 4).map((s) => ({
          key: s.key,
          category: s.category,
          poster: undefined,
          title: categoryById(s.category).title,
          sub: categoryById(s.category).label,
          href: `https://${SITE}/work`,
        }));
  return (
    <Pad>
      <div className="flex items-end justify-between">
        <div>
          <Kicker>Selected work</Kicker>
          <Title>Made to be watched on mute, at speed.</Title>
        </div>
        <a href={`https://${SITE}/work`} className="text-[1.2cqw] text-accent-ink underline-offset-4 hover:underline">
          Watch it all at {SITE}/work
        </a>
      </div>
      <div className="mt-auto grid grid-cols-4 gap-[1.2cqw]">
        {tiles.map((t) => (
          <a key={t.key} href={t.href} className="block">
            <div className="relative aspect-video overflow-hidden rounded-[1cqw] border border-default">
              {t.poster ? (
                <Image src={t.poster} alt="" fill className="object-cover" />
              ) : (
                <MotionPoster category={t.category} className="absolute inset-0" />
              )}
            </div>
            <p className="mt-[0.9cqw] font-mono text-[0.85cqw] uppercase tracking-[0.16em] text-muted-foreground">{t.sub}</p>
            <p className="mt-[0.3cqw] text-[1.35cqw] font-semibold tracking-tight text-foreground">{t.title}</p>
          </a>
        ))}
      </div>
    </Pad>
  );
}

function ClientsSlide({ names }: { names: string[] }) {
  return (
    <Pad>
      <Kicker>Brands we&apos;ve worked with</Kicker>
      <Title>Videos for teams shipping on X.</Title>
      <div className="mt-auto flex flex-wrap items-center gap-x-[5cqw] gap-y-[2cqw]">
        {CLIENTS.length > 0
          ? CLIENTS.map((c) => (
              <Image key={c.name} src={c.logo} alt={c.name} width={c.width} height={c.height} style={{ height: `${2.6 * (c.scale ?? 1)}cqw` }} className="w-auto brightness-0 invert opacity-80" />
            ))
          : names.map((n) => (
              <span key={n} className="text-[4.2cqw] font-semibold tracking-[-0.04em] text-secondary-foreground">
                {n}
              </span>
            ))}
      </div>
    </Pad>
  );
}

function ResultsSlide({ project: p }: { project: ReturnType<typeof spotlightProjects>[number] }) {
  return (
    <Pad>
      <Kicker>Results</Kicker>
      <div className="mt-[1.4cqw] grid flex-1 grid-cols-[1.25fr_1fr] items-center gap-[3cqw]">
        <a href={`https://${SITE}/work/${p.slug}`} className="relative block aspect-video overflow-hidden rounded-[1.2cqw] border border-default">
          {p.video?.poster ? <Image src={p.video.poster} alt="" fill className="object-cover" /> : null}
        </a>
        <div>
          <p className="font-mono text-[0.95cqw] uppercase tracking-[0.16em] text-muted-foreground">
            {[p.client, categoryById(p.category).label].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-[0.6cqw] text-[3.2cqw] font-semibold leading-none tracking-[-0.04em] text-foreground">{p.title}</p>
          <div className="mt-[2cqw] grid grid-cols-2 gap-[1cqw]">
            {p.metrics!.map((m, i) => (
              <div key={m.label} className="rounded-[1cqw] border border-default bg-surface p-[1.4cqw]">
                <p className={cn("font-semibold leading-none tracking-[-0.04em]", i === 0 ? "text-[3.6cqw] text-accent-ink" : "text-[2.4cqw] text-foreground")}>
                  {m.value}
                </p>
                <p className="mt-[0.4cqw] text-[1.1cqw] text-secondary-foreground">{m.label}</p>
              </div>
            ))}
          </div>
          {p.metricsNote ? <p className="mt-[1cqw] text-[0.9cqw] text-muted-foreground">{p.metricsNote}.</p> : null}
        </div>
      </div>
    </Pad>
  );
}

function ProcessSlide() {
  return (
    <Pad>
      <Kicker>How it works</Kicker>
      <Title>
        From call to final cut in <span className="whitespace-nowrap">{TURNAROUND}</span>.
      </Title>
      <div className="mt-auto grid grid-cols-5 gap-[1cqw]">
        {PROCESS.map((s, i) => (
          <div key={s.title} className="rounded-[1.2cqw] border border-default bg-surface p-[1.6cqw]">
            <span
              className={cn(
                "flex h-[2.6cqw] w-[2.6cqw] items-center justify-center rounded-full font-mono text-[1.1cqw]",
                i === PROCESS.length - 1 ? "bg-accent-primary text-accent-contrast" : "bg-elevated text-foreground"
              )}
            >
              {i + 1}
            </span>
            <p className="mt-[2cqw] text-[1.5cqw] font-semibold tracking-tight text-foreground">{s.title}</p>
            <p className="mt-[0.6cqw] text-[1.05cqw] leading-relaxed text-secondary-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </Pad>
  );
}

function WhyUsSlide() {
  const reasons = [
    { t: "X-native", b: "We make videos for the timeline, not for a showreel. Hook first, sound off, every format." },
    { t: "Zero risk", b: "You pay 100% only after you love the video. No deposit, no lock-in." },
    { t: "Fast", b: `${TURNAROUND} from brief to final cut, so the video lands while the moment is still live.` },
    { t: "Fluent in your space", b: "Crypto, products and AI are our home turf. No explaining what a mainnet is." },
  ];
  return (
    <Pad>
      <Kicker>Why brands work with us</Kicker>
      <Title>Built for the feed. Zero risk to try.</Title>
      <div className="mt-auto grid grid-cols-2 gap-[1.2cqw]">
        {reasons.map((r) => (
          <div key={r.t} className="flex gap-[1.6cqw] rounded-[1.2cqw] border border-default bg-surface p-[2cqw]">
            <span className="mt-[0.5cqw] h-[1cqw] w-[1cqw] shrink-0 rotate-45 bg-accent-primary" />
            <div>
              <p className="text-[1.7cqw] font-semibold tracking-tight text-foreground">{r.t}</p>
              <p className="mt-[0.5cqw] text-[1.15cqw] leading-relaxed text-secondary-foreground">{r.b}</p>
            </div>
          </div>
        ))}
      </div>
    </Pad>
  );
}

function TestimonialsSlide() {
  return (
    <Pad>
      <Kicker>Clients</Kicker>
      <Title>Clients come back for more.</Title>
      <div className="mt-auto grid grid-cols-4 gap-[1.2cqw]">
        {TESTIMONIALS.slice(0, 4).map((t) => (
          <div key={t.name} className="flex flex-col rounded-[1.4cqw] border border-default bg-surface p-[1.6cqw]">
            <div className="flex items-center justify-between border-b border-default pb-[1cqw]">
              <span>
                <span className="block text-[1.2cqw] font-semibold text-foreground">{t.name}</span>
                <span className="block text-[0.95cqw] text-muted-foreground">{t.company}</span>
              </span>
              <span className="font-mono text-[0.8cqw] uppercase tracking-[0.16em] text-muted-foreground">{t.source}</span>
            </div>
            <div className="mt-[1cqw] flex flex-col gap-[0.6cqw]">
              {t.messages.map((m, i) => (
                <p key={i} className="w-fit rounded-[1cqw] rounded-bl-[0.3cqw] bg-elevated px-[1.1cqw] py-[0.7cqw] text-[1.15cqw] leading-snug text-foreground">
                  {m}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Pad>
  );
}

function StartSlide() {
  const rows = [
    { k: "Book a call", v: CONTACT.calendly.replace("https://", ""), href: CONTACT.calendly },
    { k: "X", v: `@${CONTACT.x.handle}`, href: CONTACT.x.url },
    { k: "Telegram", v: `@${CONTACT.telegram.handle}`, href: CONTACT.telegram.url },
    { k: "Email", v: CONTACT.email, href: `mailto:${CONTACT.email}` },
    { k: "LinkedIn", v: CONTACT.linkedin.replace("https://www.", ""), href: CONTACT.linkedin },
  ];
  return (
    <Pad>
      <div className="pointer-events-none absolute -bottom-[14cqw] -left-[8cqw] h-[36cqw] w-[36cqw] rounded-full bg-accent-primary/15 blur-[8cqw]" />
      <Kicker>Start a project</Kicker>
      <div className="relative mt-[1.4cqw] grid flex-1 grid-cols-[1.1fr_1fr] gap-[4cqw]">
        <div>
          <h2 className="text-[6cqw] font-semibold leading-[0.92] tracking-[-0.05em] text-foreground">
            Make your next launch impossible to scroll past.
          </h2>
          <ol className="mt-[2.4cqw] space-y-[0.8cqw] text-[1.35cqw] text-secondary-foreground">
            <li>
              <span className="font-mono text-accent-ink">01</span>&nbsp;&nbsp;Book a quick call or send a DM.
            </li>
            <li>
              <span className="font-mono text-accent-ink">02</span>&nbsp;&nbsp;Get your video in {TURNAROUND}.
            </li>
            <li>
              <span className="font-mono text-accent-ink">03</span>&nbsp;&nbsp;Pay only when you love it.
            </li>
          </ol>
        </div>
        <div className="space-y-[0.9cqw] self-center">
          {rows.map((r) => (
            <a key={r.k} href={r.href} className="flex items-center justify-between rounded-[1cqw] border border-default bg-surface px-[1.8cqw] py-[1.2cqw]">
              <span className="font-mono text-[0.95cqw] uppercase tracking-[0.16em] text-muted-foreground">{r.k}</span>
              <span className="text-[1.3cqw] font-medium text-foreground">{r.v}</span>
            </a>
          ))}
        </div>
      </div>
    </Pad>
  );
}
