"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Coins,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/admin/analyses", label: "Analyses", icon: <FileText className="h-4 w-4" /> },
  { href: "/admin/leads", label: "Leads", icon: <Mail className="h-4 w-4" /> },
  { href: "/admin/detailed", label: "Detailed reports", icon: <Sparkles className="h-4 w-4" /> },
  { href: "/admin/usage", label: "Usage", icon: <Coins className="h-4 w-4" /> },
];

/**
 * Admin sub-nav. Client-only for the active-route highlight and the logout
 * button (the session cookie is httpOnly, so logging out must hit the API).
 */
export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default bg-surface px-3 py-2 shadow-card">
      <nav className="flex flex-wrap items-center gap-1">
        <span className="mr-2 flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-accent-hover" />
          Admin
        </span>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
              pathname === link.href
                ? "bg-elevated text-foreground"
                : "text-secondary-foreground hover:bg-elevated/60 hover:text-foreground"
            )}
          >
            {link.icon}
            {link.label}
          </Link>
        ))}
      </nav>

      <Button variant="ghost" size="sm" onClick={logout} disabled={pending}>
        <LogOut className="h-4 w-4" />
        Log out
      </Button>
    </div>
  );
}
