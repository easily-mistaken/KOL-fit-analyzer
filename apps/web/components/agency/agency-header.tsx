"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo-mark";
import { Wordmark } from "@/components/wordmark";
import { BookCallButton } from "@/components/agency/buttons";

const LINKS = [
  { href: "/work", label: "Work" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

/**
 * Agency top bar: transparent over the hero, solid once the page scrolls.
 * Creator Fit sits apart from the studio links: it is a separate product on
 * the same domain, not a page of the agency.
 */
export function AgencyHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile sheet on navigation.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-300",
        scrolled || open ? "border-b border-default bg-base/85 backdrop-blur-md" : "border-b border-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="OverlapX home">
          <LogoMark className="h-7 w-7" />
          <Wordmark className="text-[18px] text-foreground" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm transition-colors",
                pathname?.startsWith(l.href) ? "text-foreground" : "text-secondary-foreground hover:text-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
          <span className="mx-2 h-4 w-px bg-strong" />
          <Link
            href="/creator-fit"
            className="rounded-full px-3.5 py-2 text-sm text-secondary-foreground transition-colors hover:text-foreground"
          >
            Creator Fit
            <span className="ml-1.5 rounded-full bg-elevated px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-ink">
              Free
            </span>
          </Link>
          <BookCallButton className="ml-3 h-10" />
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-strong text-foreground md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-default px-4 pb-6 pt-2 md:hidden">
          <nav className="flex flex-col">
            {[...LINKS, { href: "/creator-fit", label: "Creator Fit (free tool)" }].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="border-b border-default py-4 text-2xl font-semibold tracking-tight text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <BookCallButton size="lg" className="mt-6 w-full" />
        </div>
      ) : null}
    </header>
  );
}
