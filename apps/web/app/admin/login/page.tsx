import { isAdminConfigured } from "@/lib/admin/auth";
import { LoginForm } from "@/components/admin/login-form";
import { NotConfigured } from "@/components/admin/primitives";

// Reads env + cookies; never prerender or cache an auth surface.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin login. Deliberately does NOT call requireAdmin() — this is the page that
 * requireAdmin() redirects to. With no ADMIN_PASSWORD set the panel is disabled,
 * so there is nothing to log into.
 */
export default async function AdminLoginPage() {
  if (!isAdminConfigured()) return <NotConfigured />;
  return <LoginForm />;
}
