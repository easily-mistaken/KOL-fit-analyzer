import type { ReactNode } from "react";

import { TopNav } from "@/components/top-nav";

/**
 * App shell: full-width dark dashboard with a top navigation bar and a
 * centered, generous-max-width main content column. Wraps every page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col bg-base"
      style={{
        backgroundImage:
          "radial-gradient(1200px 560px at 50% -300px, rgba(41,115,255,0.14), transparent 72%)",
        backgroundRepeat: "no-repeat",
      }}
    >
      <TopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
