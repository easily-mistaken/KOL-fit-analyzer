import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { CONTACT } from "@/lib/agency/content";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-base";

const sizes = {
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-[15px]",
} as const;

/** The primary call to action everywhere on the agency site: a Calendly call. */
export function BookCallButton({
  size = "md",
  className,
  label = "Book a call",
}: {
  size?: keyof typeof sizes;
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={CONTACT.calendly}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(base, sizes[size], "bg-accent-primary text-accent-contrast hover:bg-accent-hover", className)}
    >
      {label}
      <ArrowUpRight className="h-4 w-4" />
    </a>
  );
}

export function GhostLink({
  href,
  children,
  size = "md",
  className,
  external,
}: {
  href: string;
  children: React.ReactNode;
  size?: keyof typeof sizes;
  className?: string;
  external?: boolean;
}) {
  const cls = cn(base, sizes[size], "border border-strong text-foreground hover:bg-elevated", className);
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
