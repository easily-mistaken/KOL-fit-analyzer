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
