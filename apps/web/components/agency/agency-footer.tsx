import Link from "next/link";

import { LogoMark } from "@/components/logo-mark";
import { Wordmark } from "@/components/wordmark";
import { CONTACT, POSITIONING } from "@/lib/agency/content";

const COLUMNS = [
  {
    title: "Studio",
    links: [
      { href: "/work", label: "Work" },
      { href: "/pricing", label: "Pricing" },
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Tools",
    links: [{ href: "/creator-fit", label: "Creator Fit" }],
  },
  {
    title: "Connect",
    links: [
      { href: CONTACT.x.url, label: "X", external: true },
      { href: CONTACT.telegram.url, label: "Telegram", external: true },
      { href: CONTACT.linkedin, label: "LinkedIn", external: true },
      { href: `mailto:${CONTACT.email}`, label: CONTACT.email, external: true },
    ],
  },
] as const;

export function AgencyFooter() {
  return (
    <footer className="border-t border-default">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Link href="/" className="flex items-center gap-2" aria-label="OverlapX home">
            <LogoMark className="h-7 w-7" />
            <Wordmark className="text-[18px] text-foreground" />
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-secondary-foreground">{POSITIONING.eyebrow}.</p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  {"external" in l && l.external ? (
                    <a
                      href={l.href}
                      target={l.href.startsWith("mailto:") ? undefined : "_blank"}
                      rel="noopener noreferrer"
                      className="text-sm text-secondary-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="text-sm text-secondary-foreground transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-default px-4 py-6 text-xs text-muted-foreground sm:px-8">
        <span>© {new Date().getFullYear()} OverlapX</span>
        <div className="flex gap-5">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
