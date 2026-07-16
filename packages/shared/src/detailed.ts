import { z } from "zod";

import { HandleSchema } from "./handle.js";

// Detailed-report concierge requests (Unit 35). The user shares their Telegram
// and X handle; the operator curates and delivers manually. Normalization is
// forgiving on input (URLs, @-prefixes) but strict on the stored shape.

/** "@name", "t.me/name", "https://t.me/name" -> "name". */
export function normalizeTelegram(input: string): string {
  let s = input.trim();
  s = s.replace(/^https?:\/\//i, "");
  s = s.replace(/^(www\.)?t(elegram)?\.me\//i, "");
  s = s.replace(/^@+/, "");
  s = s.split(/[/?#]/)[0] ?? "";
  return s;
}

/** "@name", "x.com/name", "https://twitter.com/name?s=21" -> "name". */
export function normalizeXHandle(input: string): string {
  let s = input.trim();
  s = s.replace(/^https?:\/\//i, "");
  s = s.replace(/^(www\.|mobile\.)?(x|twitter)\.com\//i, "");
  s = s.replace(/^@+/, "");
  s = s.split(/[/?#]/)[0] ?? "";
  return s;
}

const TELEGRAM_USERNAME = /^[A-Za-z0-9_]{4,32}$/;
const X_USERNAME = /^[A-Za-z0-9_]{1,15}$/;

export const DetailedReportRequestInputSchema = z.object({
  telegram: z
    .string()
    .transform(normalizeTelegram)
    .pipe(
      z
        .string()
        .regex(TELEGRAM_USERNAME, "Enter a valid Telegram username (e.g. @yourname).")
    ),
  xHandle: z
    .string()
    .transform(normalizeXHandle)
    .pipe(
      z
        .string()
        .regex(X_USERNAME, "Enter a valid X handle or profile link.")
    ),
  orgHandle: HandleSchema.optional(),
  kolHandle: HandleSchema.optional(),
  analysisRequestId: z.string().trim().min(10).max(40).optional(),
  note: z.string().trim().max(500).optional(),
});
export type DetailedReportRequestInput = z.infer<
  typeof DetailedReportRequestInputSchema
>;
