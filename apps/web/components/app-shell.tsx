import type { ReactNode } from "react";

import { TopNav } from "@/components/top-nav";
import { UserMenu } from "@/components/auth/user-menu";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * App shell: full-width dark dashboard with a top navigation bar and a
 * centered, generous-max-width main content column. Wraps every page. Resolves
 * the current user on the server (best-effort) and hands the nav a user menu
 * (Unit 28).
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div
      className="flex min-h-screen flex-col bg-base"
      style={{
        backgroundImage:
          "radial-gradient(1200px 560px at 50% -300px, var(--shell-glow), transparent 72%)",
        backgroundRepeat: "no-repeat",
      }}
    >
      <TopNav userMenu={<UserMenu user={user} />} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}
