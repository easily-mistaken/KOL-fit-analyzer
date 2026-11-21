import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { BookCallButton } from "@/components/agency/buttons";
import { Faq, FinalCta, FreeResources } from "@/components/agency/blocks";
import { Eyebrow, Section, SectionHeading } from "@/components/agency/section";
import { WorkGrid } from "@/components/agency/work-grid";
import { GUIDES, guideExamples, type Guide } from "@/lib/agency/guides";
import { serviceBySlug } from "@/lib/agency/services";
import { guideJsonLd, jsonLdHtml } from "@/lib/agency/seo";

const LINK = "text-foreground underline decoration-accent-primary underline-offset-4 hover:text-accent-ink";

/**
 * Turns a guide paragraph's [label](href) links into real links. External
 * links open in a new tab with rel="noopener" only, so the sites we cite (Launch
 * Gallery) keep the Referer; see LAUNCH_GALLERY.
 */
function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const [whole, label, href] = m;
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(
      !href.startsWith("/") ? (
        href.startsWith("http") ? (
          <a key={at} href={href} target="_blank" rel="noopener" className={LINK}>
            {label}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <a key={at} href={href} className={LINK}>
            {label}
          </a>
        )
      ) : (
        <Link key={at} href={href} className={LINK}>
          {label}
        </Link>
      )
    );
    last = at + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function sectionId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One guide (Unit 56): the short answer first, then the detail, worked
 * examples from the portfolio, the guide's FAQ and the matching service.
 * The article text is not wrapped in <Reveal>, so it reads without waiting
 * on scroll animations.
 */
export function GuidePage({ guide }: { guide: Guide }) {
  const service = serviceBySlug(guide.service);
  const others = GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(guideJsonLd(guide)) }} />

      <article>
        <Section className="pb-0 sm:pb-0">
          <Link
            href="/guides"
            className="-my-3 inline-flex min-h-11 items-center gap-2 text-sm text-secondary-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> All guides
          </Link>
          <div className="mt-8 max-w-3xl">
            <Eyebrow>Guide</Eyebrow>
            <h1 className="mt-4 text-[clamp(34px,5.2vw,64px)] font-semibold leading-[0.98] tracking-[-0.035em] text-balance text-foreground">
              {guide.title}
            </h1>
            <p className="mt-5 text-sm text-muted-foreground">
              By OverlapX · Updated <time dateTime={guide.updated}>{formatDate(guide.updated)}</time>
            </p>
          </div>

          <div className="mt-10 max-w-3xl rounded-3xl border border-default bg-surface p-6 sm:p-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">The short answer</h2>
            <p className="mt-3 text-lg leading-relaxed text-pretty text-foreground sm:text-xl">
              <RichText text={guide.summary} />
            </p>
          </div>

          <nav aria-label="In this guide" className="mt-10 hidden max-w-3xl sm:block">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">In this guide</p>
            <ol className="mt-2 grid gap-x-8 sm:grid-cols-2">
              {guide.sections.map((s) => (
                <li key={s.heading}>
                  <a
                    href={`#${sectionId(s.heading)}`}
                    className="inline-flex min-h-11 items-center text-sm text-secondary-foreground hover:text-foreground"
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </Section>

        <Section className="pt-12 sm:pt-16">
          <div className="max-w-2xl space-y-12">
            {guide.sections.map((s) => (
              <section key={s.heading} id={sectionId(s.heading)} className="scroll-mt-24">
                <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">{s.heading}</h2>
                {s.paragraphs.map((p, i) => (
                  <p key={i} className="mt-4 text-[17px] leading-relaxed text-pretty text-secondary-foreground">
                    <RichText text={p} />
                  </p>
                ))}
                {s.list ? (
                  <ul className="mt-4 space-y-2.5">
                    {s.list.map((item) => (
                      <li key={item} className="flex gap-3 text-[17px] leading-relaxed text-secondary-foreground">
                        <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-[1px] bg-accent-primary" aria-hidden />
                        <span>
                          <RichText text={item} />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {s.template ? (
                  <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-default bg-surface p-5 font-mono text-sm leading-loose text-foreground">
                    {s.template.join("\n")}
                  </pre>
                ) : null}
              </section>
            ))}
          </div>
        </Section>
      </article>

      <Section>
        <SectionHeading
          eyebrow="Examples"
          title="Made by OverlapX."
          lead="Each project opens with its brief and the full video."
        />
        <WorkGrid projects={guideExamples(guide)} />
      </Section>

      <Section className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
        <SectionHeading eyebrow="FAQ" title="Questions, answered." className="mb-0 self-start sm:mb-0 md:sticky md:top-24" />
        <Faq items={guide.faqs} />
      </Section>

      <Section className="py-8 sm:py-12">
        <div className="flex flex-col gap-6 rounded-3xl border border-default p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <Eyebrow>{service.label}</Eyebrow>
            <p className="mt-3 text-[clamp(24px,3vw,36px)] font-semibold leading-[1.05] tracking-[-0.03em] text-balance text-foreground">
              Want one made for you?
            </p>
            <p className="mt-3 leading-relaxed text-secondary-foreground">
              OverlapX makes these for crypto brands, startups and AI products on X. See{" "}
              <Link href={`/${service.slug}`} className={LINK}>
                {service.label} at OverlapX
              </Link>
              .
            </p>
          </div>
          <BookCallButton size="lg" className="self-start md:self-center" />
        </div>
      </Section>

      <FreeResources items={["gallery", "idea"]} />

      <Section className="py-8 sm:py-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">More guides</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {others.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-default px-5 py-4 text-foreground transition-colors hover:bg-elevated"
              >
                <span className="font-medium">{g.title}</span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <FinalCta />
    </>
  );
}
