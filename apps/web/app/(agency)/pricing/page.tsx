import type { Metadata } from "next";

import { Section, SectionHeading } from "@/components/agency/section";
import { Faq, FinalCta, PricingFactors, ProcessSteps } from "@/components/agency/blocks";
import { TURNAROUND } from "@/lib/agency/content";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Every OverlapX video is quoted for its brief: length, style and quality level. Most ship in ${TURNAROUND}, and you pay only when you love it.`,
};

export default function PricingPage() {
  return (
    <>
      <Section>
        <SectionHeading
          eyebrow="Pricing"
          title="Priced for your video, not a menu."
          lead="Every video is different, so every quote is too. Tell us what you have in mind on a quick call and you get a clear price before any work starts."
        />
        <PricingFactors />
      </Section>
      <ProcessSteps />
      <Section className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
        <SectionHeading eyebrow="FAQ" title="Questions, answered." className="mb-0 self-start sm:mb-0 md:sticky md:top-24" />
        <Faq />
      </Section>
      <FinalCta />
    </>
  );
}
