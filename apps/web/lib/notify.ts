// Operator alerts (Unit 36).
//
// SCOPE, because this is easy to misread: the bot behind these env vars is
// PRIVATE. It exists solely to DM the operator when a lead lands, so follow-up
// doesn't depend on anyone remembering to open the admin panel. It is never
// shown to users, users never message it, and nothing is ever delivered TO a
// user through it — outreach happens from the operator's own account, using
// the handle the requester supplied. (A user-facing "open @bot and tap Start"
// flow did exist and was removed in Unit 45: a public bot is a second product
// surface to run, and it bought nothing that a personal DM doesn't.)
//
// Fire-and-forget: never throws, and a notification failure must never fail the
// user-facing request. Silent no-op when the env vars are unset.

const TIMEOUT_MS = 5000;

export async function notifyOperator(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (!token || !chatId) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: controller.signal,
    });
  } catch {
    // Swallow: best-effort only. (Do not log the error object — the request
    // URL contains the bot token.)
  } finally {
    clearTimeout(timer);
  }
}

/** Compact operator-facing summary of a new detailed-report request. */
export function buildDetailedRequestNotification(input: {
  telegram: string;
  xHandle: string;
  email?: string | null;
  orgHandle?: string | null;
  kolHandle?: string | null;
  note?: string | null;
}): string {
  const lines = ["🔔 New detailed-report request"];
  if (input.orgHandle || input.kolHandle) {
    lines.push(`Pair: @${input.orgHandle ?? "?"} × @${input.kolHandle ?? "?"}`);
  }
  lines.push(`Telegram: @${input.telegram} | X: @${input.xHandle}`);
  if (input.email) lines.push(`Email: ${input.email}`);
  if (input.note) {
    const note = input.note.length > 120 ? `${input.note.slice(0, 120)}…` : input.note;
    lines.push(`Note: ${note}`);
  }
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (base) lines.push(`${base.replace(/\/+$/, "")}/admin/detailed`);
  return lines.join("\n");
}

/** Compact operator-facing summary of a captured email (Unit 44). Sent to the
 *  same Telegram channel as detailed-report requests: a lead is only worth
 *  capturing if someone actually follows up, and polling the admin panel is not
 *  a follow-up mechanism. */
export function buildLeadNotification(input: {
  email: string;
  source: string;
  orgHandle?: string | null;
  kolHandle?: string | null;
  returning: boolean;
}): string {
  const lines = [
    input.returning ? "🔁 Returning lead" : "📥 New email captured",
    `Email: ${input.email}`,
    `Where: ${input.source}`,
  ];
  if (input.orgHandle || input.kolHandle) {
    lines.push(`Looking at: @${input.orgHandle ?? "?"} × @${input.kolHandle ?? "?"}`);
  }
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (base) lines.push(`${base.replace(/\/+$/, "")}/admin/people`);
  return lines.join("\n");
}

/** Compact operator-facing summary of a new allowance-raise request (Unit 47).
 *  Leads the message with the contact channels, since the whole point of the
 *  ask is to have a way to reach them for feedback. */
export function buildLimitRaiseNotification(input: {
  email?: string | null;
  currentLimit: number;
  requestedLimit: number;
  contactTelegram?: string | null;
  contactEmail?: string | null;
  contactOtherLabel?: string | null;
  contactOtherValue?: string | null;
  note?: string | null;
}): string {
  const lines = [
    "⬆️ New analysis-limit raise request",
    `Wants: ${input.currentLimit} → ${input.requestedLimit} analyses`,
  ];
  if (input.email) lines.push(`Account: ${input.email}`);
  const contacts: string[] = [];
  if (input.contactTelegram) contacts.push(`Telegram @${input.contactTelegram}`);
  if (input.contactEmail) contacts.push(`Email ${input.contactEmail}`);
  if (input.contactOtherLabel && input.contactOtherValue) {
    contacts.push(`${input.contactOtherLabel}: ${input.contactOtherValue}`);
  }
  if (contacts.length) lines.push(`Reach them: ${contacts.join(" | ")}`);
  if (input.note) {
    const note = input.note.length > 120 ? `${input.note.slice(0, 120)}…` : input.note;
    lines.push(`Note: ${note}`);
  }
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (base) lines.push(`${base.replace(/\/+$/, "")}/admin/upgrades`);
  return lines.join("\n");
}

/**
 * A browser's FIRST analysis (Unit 46) — a new user showing up, not a click.
 *
 * Deliberately not sent on every run: an alert that fires on all activity is
 * one you learn to ignore, which quietly costs you the two alerts above that
 * actually carry a contact. This fires once per owner, ever.
 *
 * `email` is present only when they were signed in — that is the difference
 * between "someone new is trying it" and "someone new is trying it AND you can
 * reach them", so it leads the message when known.
 */
export function buildFirstRunNotification(input: {
  orgHandle: string;
  kolHandle: string;
  email?: string | null;
}): string {
  const lines = [
    input.email ? "🌱 New signed-in user, first run" : "🌱 New visitor, first run",
  ];
  if (input.email) lines.push(`Email: ${input.email}`);
  lines.push(`Analysing: @${input.orgHandle} × @${input.kolHandle}`);
  if (!input.email) lines.push("No contact yet — anonymous browser.");
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (base) {
    // /admin/people is keyed by EMAIL, so an anonymous visitor is provably not
    // on it — linking there would send you looking for someone who cannot be
    // found. Their run is on /admin/analyses. (Caught in live verification.)
    const path = input.email ? "/admin/people" : "/admin/analyses";
    lines.push(`${base.replace(/\/+$/, "")}${path}`);
  }
  return lines.join("\n");
}
