// Operator notifications (Unit 36). Fire-and-forget pings to the OPERATOR's
// own Telegram (bot token + chat id from env) — e.g. when a detailed-report
// request lands, so the "within a day" promise doesn't depend on polling the
// admin queue. Never throws; a notification failure must never fail the
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
  lines.push(`Telegram: @${input.telegram} — X: @${input.xHandle}`);
  if (input.email) lines.push(`Email: ${input.email}`);
  if (input.note) {
    const note = input.note.length > 120 ? `${input.note.slice(0, 120)}…` : input.note;
    lines.push(`Note: ${note}`);
  }
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (base) lines.push(`${base.replace(/\/+$/, "")}/admin/detailed`);
  return lines.join("\n");
}
