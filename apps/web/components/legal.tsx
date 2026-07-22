import type { ReactNode } from "react";
import { ShieldCheck, Scale } from "lucide-react";

import { BackButton } from "@/components/back-button";

/**
 * Shared shell for the legal pages (/privacy, /terms). Both are plain prose in
 * a single card, so the structure lives here once and each page contributes
 * only its text.
 */

const ICONS = { shield: ShieldCheck, scale: Scale } as const;

export function LegalPage({
  eyebrow,
  icon,
  title,
  updated,
  intro,
  children,
}: {
  eyebrow: string;
  icon: keyof typeof ICONS;
  title: string;
  updated: string;
  intro: string;
  children: ReactNode;
}) {
  const Icon = ICONS[icon];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <BackButton fallbackHref="/" label="Back" />

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-accent-ink">
          <Icon className="h-4 w-4" />
          {eyebrow}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-secondary-foreground">
          Last updated {updated}. {intro}
        </p>
      </div>

      <div className="space-y-8 rounded-2xl border border-default bg-surface p-6 shadow-card sm:p-8">
        {children}
      </div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-secondary-foreground">
        {children}
      </div>
    </section>
  );
}

export function LegalBullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="ml-4 list-disc space-y-2 marker:text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** Emphasised lead-in for a bullet, e.g. "Account information." */
export function LegalTerm({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>;
}
