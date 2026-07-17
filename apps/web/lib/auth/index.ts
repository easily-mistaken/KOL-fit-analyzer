// Web auth glue barrel (Unit 28). The seam the app reads is getCurrentUserId /
// getCurrentUser; the claim helper backs the login callback. The Supabase
// adapter is intentionally NOT re-exported here — it is reached only via dynamic
// import() from the supabase-mode branches so the runtime never loads
// @supabase/ssr until sign-in is active.
export { getCurrentUserId, getCurrentUser } from "./current-user";
export { claimAnonymousReports } from "./claim";
