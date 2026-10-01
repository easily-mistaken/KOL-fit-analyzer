import type { Metadata } from "next";

import { Section, SectionHeading } from "@/components/agency/section";
import { Faq, FinalCta, PricingCards, ProcessSteps } from "@/components/agency/blocks";
import { TURNAROUND } from "@/lib/agency/content";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Motion graphics and AI videos from $999, delivered in ${TURNAROUND}. Pay only when you love it.`,
};

export default function PricingPage() {
  return (
    <>
      <Section>
        <SectionHeading
          eyebrow="Pricing"
          title="Simple pricing. Zero risk."
          lead={`Two fixed-price videos to start, custom plans for everything else. Every video ships in ${TURNAROUND}, in every format, and you pay only once you love it.`}
        />
        <PricingCards />
      </Section>
      <ProcessSteps />
      <Section className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
        <SectionHeading eyebrow="FAQ" title="Questions, answered." className="mb-0 sm:mb-0" />
        <Faq />
      </Section>
      <FinalCta />
    </>
  );
}
