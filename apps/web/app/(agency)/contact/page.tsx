import type { Metadata } from "next";
import { ArrowUpRight, AtSign, Briefcase, Mail, Send } from "lucide-react";

import { Reveal } from "@/components/agency/reveal";
import { Section, SectionHeading } from "@/components/agency/section";
import { CONTACT, TURNAROUND } from "@/lib/agency/content";

export const metadata: Metadata = {
  title: "Contact",
  description: "Book a quick call with OverlapX, or reach us on X, Telegram, LinkedIn or email.",
};

const CHANNELS = [
  { label: "X", value: `@${CONTACT.x.handle}`, href: CONTACT.x.url, icon: AtSign },
  { label: "Telegram", value: `@${CONTACT.telegram.handle}`, href: CONTACT.telegram.url, icon: Send },
  { label: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}`, icon: Mail },
  { label: "LinkedIn", value: "Tanmay Jain", href: CONTACT.linkedin, icon: Briefcase },
] as const;

export default function ContactPage() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Contact"
        title="Let's make your next video."
        lead={`Book a quick call and tell us what you're launching. Your video ships in ${TURNAROUND}, and you pay only when you love it.`}
      />
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <Reveal className="overflow-hidden rounded-3xl border border-default bg-surface">
          <iframe
            title="Book a call with OverlapX"
            src={`${CONTACT.calendly}?embed_type=Inline&hide_gdpr_banner=1&background_color=111419&text_color=ffffff&primary_color=bef54b`}
            className="h-[720px] w-full"
            loading="lazy"
          />
        </Reveal>
        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Or message us directly</p>
          {CHANNELS.map((c, i) => (
            <Reveal key={c.label} delay={i * 70}>
              <a
                href={c.href}
                target={c.href.startsWith("mailto:") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="group flex items-center gap-4 rounded-2xl border border-default bg-surface p-5 transition-colors hover:border-strong"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-elevated text-foreground">
                  <c.icon className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm text-muted-foreground">{c.label}</span>
                  <span className="block font-medium text-foreground">{c.value}</span>
                </span>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
