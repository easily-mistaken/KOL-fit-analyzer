import { redirect } from "next/navigation";
import { resolveAuthMode } from "@kol-fit/auth";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { LoginForm } from "@/components/auth/login-form";

// Reads env + cookies; never prerender or cache an auth surface.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Login page (Unit 28, Google-only). Already signed in → straight to the reports
 * list. Otherwise render the Google sign-in (or a notice when Supabase isn't
 * configured here).
 */
export default async function LoginPage() {
  if (await getCurrentUserId()) redirect("/analyses");
  const mode = resolveAuthMode(process.env);

  return (
    <div className="py-10">
      <LoginForm mode={mode} />
    </div>
  );
}
