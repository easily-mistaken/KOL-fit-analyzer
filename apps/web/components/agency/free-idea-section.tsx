import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import type { IdeaSource } from "@kol-fit/shared/video-idea-options";
import { Eyebrow, Section } from "@/components/agency/section";
import { VideoIdeaForm } from "@/components/agency/video-idea-form";
import { LAUNCH_GALLERY } from "@/lib/agency/content";

// Its own module (not blocks.tsx) so only the pages that show the form load
// its client code.

/**
 * "Get a free video idea" (Unit 57): the pitch beside the form. The form is
 * the same one as on launchgallery.video, so a visitor of either site gets
 * the same offer.
 */
export function FreeIdeaSection({
  source,
  headingLevel = "h2",
  crossLinks = false,
}: {
  source: IdeaSource;
  headingLevel?: "h1" | "h2";
  /** Launch Gallery and Creator Fit rows under the pitch; off where the page already promotes both nearby. */
  crossLinks?: boolean;
}) {
  const Heading = headingLevel;
  return (
    <Section id="free-video-idea" className="grid gap-10 md:grid-cols-[1fr_1.15fr] md:gap-14">
      <div className="md:sticky md:top-24 md:self-start">
        <Eyebrow>Free video idea</Eyebrow>
        <Heading className="mt-4 text-[clamp(32px,4.6vw,60px)] font-semibold leading-[0.98] tracking-[-0.035em] text-balance text-foreground">
          Not sure what your launch video should be?
        </Heading>
        <p className="mt-5 max-w-md text-base leading-relaxed text-pretty text-secondary-foreground sm:text-lg">
          Tell us what you&apos;re launching and your budget, and we&apos;ll send you a video idea for your X launch,
          free. No call needed, and it takes about 20 seconds.
        </p>
        {crossLinks ? (
          <ul className="mt-8 grid max-w-md gap-3">
            <li>
              <a
                href={LAUNCH_GALLERY.url}
                target="_blank"
                rel="noopener"
                className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-default px-5 py-3 text-foreground transition-colors hover:bg-elevated"
              >
                <span>
                  <span className="block font-medium">Want references first?</span>
                  <span className="block text-sm text-secondary-foreground">Find inspiration on {LAUNCH_GALLERY.name}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <Link
                href="/creator-fit"
                className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-default px-5 py-3 text-foreground transition-colors hover:bg-elevated"
              >
                <span>
                  <span className="block font-medium">Paying a creator to post it?</span>
                  <span className="block text-sm text-secondary-foreground">Check if they fit with Creator Fit, free</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
            </li>
          </ul>
        ) : null}
      </div>
      <VideoIdeaForm source={source} />
    </Section>
  );
}
