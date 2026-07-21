import { z } from "zod";

import { normalizeTelegram } from "./detailed.js";

// Self-serve allowance-raise requests (Unit 47). A signed-in user who has used
// their lifetime analyses asks to unlock the next rung; the operator approves
// and User.analysisLimit is raised. The ladder steps one rung at a time
// (10 -> 25 -> 50) — you can only ask for the tier immediately above your
// current allowance, never skip. 50 is the ceiling for now; extend LADDER to
// add rungs.

/** The raised rungs above the free tier, ascending. The free-tier base
 *  (TIER_LIMITS.userLifetime, 10) is intentionally NOT in here — it is where
 *  everyone starts, not something you can request. */
export const LIMIT_RAISE_TIERS = [25, 50] as const;

/** The current top of the ladder. */
export const LIMIT_RAISE_MAX = LIMIT_RAISE_TIERS[LIMIT_RAISE_TIERS.length - 1];

/**
 * The next rung a user on `currentLimit` may request: the smallest tier strictly
 * greater than their current allowance, or null when they are already at (or
 * above) the ceiling. Base-agnostic, so an env-raised free tier still resolves
 * correctly (e.g. a base of 30 skips 25 and offers 50).
 */
export function nextLimitTier(currentLimit: number): number | null {
  for (const tier of LIMIT_RAISE_TIERS) {
    if (tier > currentLimit) return tier;
  }
  return null;
}

const TELEGRAM_USERNAME = /^[A-Za-z0-9_]{4,32}$/;

/** "" / whitespace -> undefined, so optional contact fields left blank in the
 *  form don't fail their format checks. */
const emptyToUndefined = (v: unknown): unknown =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

// Review-contact capture. The user gives one OR MORE ways to reach them for
// feedback — Telegram, email, and/or another channel — with at least one
// required (enforced below). Ordered Telegram-first in the UI, but all optional
// individually.
export const LimitRaiseRequestInputSchema = z
  .object({
    contactTelegram: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .transform(normalizeTelegram)
        .pipe(
          z
            .string()
            .regex(
              TELEGRAM_USERNAME,
              "Enter a valid Telegram username (e.g. @yourname)."
            )
        )
        .optional()
    ),
    contactEmail: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .toLowerCase()
        .pipe(z.email("Enter a valid email address."))
        .optional()
    ),
    contactOtherLabel: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(2).max(40).optional()
    ),
    contactOtherValue: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(2).max(160).optional()
    ),
    note: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(500).optional()
    ),
  })
  .superRefine((val, ctx) => {
    const hasTelegram = Boolean(val.contactTelegram);
    const hasEmail = Boolean(val.contactEmail);
    const hasOther = Boolean(val.contactOtherLabel) || Boolean(val.contactOtherValue);
    if (!hasTelegram && !hasEmail && !hasOther) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least one way to reach you — it's how we say thanks.",
        path: ["contactTelegram"],
      });
    }
    // "Other" needs both a channel name and a value to be usable.
    if (val.contactOtherLabel && !val.contactOtherValue) {
      ctx.addIssue({
        code: "custom",
        message: "Add the contact for your other channel.",
        path: ["contactOtherValue"],
      });
    }
    if (val.contactOtherValue && !val.contactOtherLabel) {
      ctx.addIssue({
        code: "custom",
        message: "Name the other channel (e.g. Discord, WhatsApp).",
        path: ["contactOtherLabel"],
      });
    }
  });

export type LimitRaiseRequestInput = z.infer<typeof LimitRaiseRequestInputSchema>;
