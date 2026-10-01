"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo-mark";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Top navigation bar: product mark (links home), primary links with an
 * active-route indicator, the theme switch, and the user menu (Unit 28), which
 * is resolved on the server and passed in as `userMenu`.
 */
export function TopNav({ userMenu }: { userMenu?: React.ReactNode }) {
  const pathname = usePathname();
  const isReports = pathname?.startsWith("/creator-fit/analyses");
  const isNew = pathname === "/creator-fit";

  return (
    <header className="sticky top-0 z-20 border-b border-default bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          {/* The mark returns to the OverlapX umbrella home; the product label
              beside it returns to the tool. */}
          <Link href="/" className="flex items-center gap-2" aria-label="OverlapX home">
            <LogoMark className="h-7 w-7" />
            <Wordmark className="text-[17px] text-foreground" />
          </Link>
          <Link
            href="/creator-fit"
            className="hidden rounded-full border border-default px-2.5 py-0.5 text-[12px] font-medium text-secondary-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Creator Fit
          </Link>
        </div>

        <nav className="flex items-center gap-1">
          <NavLink href="/creator-fit" active={isNew} icon={<Plus className="h-4 w-4" />}>
            Analyze
          </NavLink>
          <NavLink
            href="/creator-fit/analyses"
            active={isReports}
            icon={<FileText className="h-4 w-4" />}
          >
            History
          </NavLink>
          <span className="ml-1 flex items-center border-l border-default pl-1">
            <ThemeToggle />
          </span>
          {userMenu ? (
            <span className="flex items-center">{userMenu}</span>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors sm:px-3",
        active
          ? "bg-elevated text-foreground"
          : "text-secondary-foreground hover:bg-elevated/60 hover:text-foreground"
      )}
    >
      {icon}
      {/* Labels collapse to icons on mobile so the nav fits a phone width;
          kept in the a11y tree via sr-only, shown from sm up. */}
      <span className="sr-only sm:not-sr-only">{children}</span>
    </Link>
  );
}
