"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { THEME_STORAGE_KEY } from "@/lib/theme";

type Theme = "light" | "dark";

/**
 * Light/dark switch. Light is the default; dark is opt-in and remembered.
 *
 * The stored choice is applied by the inline script in layout.tsx before first
 * paint, so this component never decides the theme on mount — it only reads
 * back what the document already has and drives it from there. The icon is
 * withheld until mounted because the server can't know the reader's stored
 * choice, and rendering a guess would be a hydration mismatch.
 */
export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>("light");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled: the theme still applies for this page.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? `Switch to ${theme === "dark" ? "light" : "dark"} theme` : "Switch theme"}
      title={mounted ? `Switch to ${theme === "dark" ? "light" : "dark"} theme` : undefined}
      className="flex h-8 w-8 items-center justify-center rounded-full text-secondary-foreground transition-colors hover:bg-elevated hover:text-foreground"
    >
      {mounted ? (
        theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )
      ) : (
        <span className="h-4 w-4" />
      )}
    </button>
  );
}
