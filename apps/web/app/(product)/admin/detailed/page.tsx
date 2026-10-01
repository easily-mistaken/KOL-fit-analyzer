import { redirect } from "next/navigation";

// Consolidated into /admin/leads (Unit 39.1) — the concierge queue IS the
// lead list. Kept as a redirect so old links keep working.
export default function AdminDetailedRedirect() {
  redirect("/admin/leads");
}
