"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FileText, Plus } from "lucide-react";
import { APP_NAME } from "@kol-fit/shared";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Top navigation bar: product mark (links home), primary links with an
 * active-route indicator, and a build-stage marker.
 */
export function TopNav() {
  const pathname = usePathname();
  const isReports = pathname?.startsWith("/analyses");
  const isNew = pathname === "/";

  return (
    <header className="sticky top-0 z-20 border-b border-default bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-primary to-[#1e51c9] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
            <Activity className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {APP_NAME}
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink href="/" active={isNew} icon={<Plus className="h-4 w-4" />}>
            New
          </NavLink>
          <NavLink
            href="/analyses"
            active={isReports}
            icon={<FileText className="h-4 w-4" />}
          >
            Reports
          </NavLink>
          <Badge
            variant="outline"
            className="ml-2 hidden text-muted-foreground sm:inline-flex"
          >
            Internal
          </Badge>
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
