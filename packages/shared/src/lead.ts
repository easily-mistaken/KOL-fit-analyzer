import { z } from "zod";

import { HandleSchema } from "./handle.js";

// Lightweight email capture (Unit 44). Deliberately ONE field: this fires at
// the moment a reader has just been given something valuable, and every extra
// input at that moment costs conversion. The richer, higher-intent ask (with
// Telegram + X) stays on the detailed-report form.

/** Where the email was captured. Intent differs sharply by capture point, and
 *  outreach should be able to tell "just finished reading a full report" from
 *  "hovering on the landing page". */
export const LeadSourceSchema = z.enum(["report", "waiting", "landing"]);
export type LeadSource = z.infer<typeof LeadSourceSchema>;

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  report: "Finished a report",
  waiting: "Waiting on a run",
  landing: "Landing page",
};

export const LeadCaptureInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  source: LeadSourceSchema.default("report"),
  analysisRequestId: z.string().trim().min(10).max(40).optional(),
  orgHandle: HandleSchema.optional(),
  kolHandle: HandleSchema.optional(),
  note: z.string().trim().max(500).optional(),
});
export type LeadCaptureInput = z.infer<typeof LeadCaptureInputSchema>;
