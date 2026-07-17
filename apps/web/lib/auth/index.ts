// Web auth glue barrel (Unit 28). The seam the app reads is getCurrentUserId /
// getCurrentUser; the dev-session and claim helpers back the auth routes. The
// Supabase adapter is intentionally NOT re-exported here — it is reached only
// via dynamic import() from the supabase-mode branches so the dev runtime never
// loads @supabase/ssr.
export { getCurrentUserId, getCurrentUser } from "./current-user";
export { clearDevSession } from "./session";
export { claimAnonymousReports } from "./claim";
