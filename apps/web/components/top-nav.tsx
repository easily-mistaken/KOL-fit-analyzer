"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { APP_NAME } from "@kol-fit/shared";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Top navigation bar: product mark (links home), primary links with an
 * active-route indicator, the theme switch, and the user menu (Unit 28), which
 * is resolved on the server and passed in as `userMenu`.
 */
export function TopNav({ userMenu }: { userMenu?: React.ReactNode }) {
  const pathname = usePathname();
  const isReports = pathname?.startsWith("/analyses");
  const isNew = pathname === "/";

  return (
    <header className="sticky top-0 z-20 border-b border-default bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        {/* Mark lives at /public/logo.svg so the brand asset can be swapped
            without touching this component. */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.svg"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7"
            priority
          />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {APP_NAME}
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink href="/" active={isNew} icon={<Plus className="h-4 w-4" />}>
            Analyze
          </NavLink>
          <NavLink
            href="/analyses"
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
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-elevated text-foreground"
          : "text-secondary-foreground hover:bg-elevated/60 hover:text-foreground"
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
