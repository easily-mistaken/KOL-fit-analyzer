import Link from "next/link";
import { Activity, FileText } from "lucide-react";
import { APP_NAME } from "@kol-fit/shared";

import { Badge } from "@/components/ui/badge";

/**
 * Static top navigation bar. Shows the product name (from @kol-fit/shared),
 * a link to the saved-reports list (Unit 20), and a build-stage marker.
 */
export function TopNav() {
  return (
    <header className="sticky top-0 z-10 border-b border-default bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-elevated text-accent-hover">
            <Activity className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {APP_NAME}
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/analyses"
            className="flex items-center gap-1.5 text-sm text-secondary-foreground transition-colors hover:text-foreground"
          >
            <FileText className="h-4 w-4" />
            Reports
          </Link>
          <Badge variant="outline" className="text-muted-foreground">
            Internal
          </Badge>
        </div>
      </div>
    </header>
  );
}
