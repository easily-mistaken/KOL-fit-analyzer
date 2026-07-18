"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Consistent "back" control for deep pages that aren't top-level nav
 * destinations (detailed request, login, …). Goes to the real previous page
 * when there's history, else to `fallbackHref` — so it never dead-ends. Styled
 * as a proper pill button (not a faint text link) so it reads as clickable.
 */
export function BackButton({
  fallbackHref = "/",
  label = "Back",
  className,
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-default bg-surface px-3.5 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:border-strong hover:bg-elevated hover:text-foreground",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
