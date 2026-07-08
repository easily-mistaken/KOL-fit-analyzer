import { Activity } from "lucide-react";
import { APP_NAME } from "@kol-fit/shared";

import { Badge } from "@/components/ui/badge";

/**
 * Static top navigation bar. Shows the product name (from @kol-fit/shared)
 * and a build-stage marker. No links yet — routes beyond the landing page do
 * not exist until later units, so we do not fabricate dead nav targets.
 */
export function TopNav() {
  return (
    <header className="sticky top-0 z-10 border-b border-default bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-elevated text-accent-hover">
            <Activity className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {APP_NAME}
          </span>
        </div>
        <Badge variant="outline" className="text-muted-foreground">
          Internal
        </Badge>
      </div>
    </header>
  );
}
