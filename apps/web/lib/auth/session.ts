import { cookies } from "next/headers";

// Sign-out cookie hygiene (Unit 28). Passwordless dev login was removed when
// auth went Google-only, so nothing issues the `kolfit_session` cookie anymore;
// this only clears any legacy cookie on sign-out. Signed-in identity now comes
// entirely from Supabase (see current-user.ts / supabase.ts).

const COOKIE = "kolfit_session";

/** Clears any legacy dev-session cookie. Safe to call without a session. */
export async function clearDevSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
