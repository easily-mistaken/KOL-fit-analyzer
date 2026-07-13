import { z } from "zod";

import { HandleSchema } from "./handle.js";

// User-submitted analysis request. Fields correspond 1:1 to the nullable
// AnalysisRequest columns (Unit 03). workspaceId is NOT user input — it is set
// server-side later (auth is out of scope for the first build).
export const AnalysisRequestInputSchema = z.object({
  orgHandle: HandleSchema,
  kolHandle: HandleSchema,
  websiteUrl: z.url().optional(),
  docsUrl: z.url().optional(),
  productCategory: z.string().trim().min(1).max(120).optional(),
  targetUser: z.string().trim().min(1).max(280).optional(),
  // Free string; see CampaignGoalSchema in vocab.ts for the known set.
  campaignGoal: z.string().trim().min(1).max(120).optional(),
  // Free string; see ProductStageSchema in vocab.ts for the known set.
  stage: z.string().trim().min(1).max(120).optional(),
  region: z.string().trim().min(1).max(120).optional(),
});
export type AnalysisRequestInput = z.infer<typeof AnalysisRequestInputSchema>;

// Report delivery / lead capture (Unit 24). Email and/or Telegram; ≥1 required.
export const ReportDeliverInputSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    telegramHandle: z
      .string()
      .trim()
      .transform((s) => s.replace(/^@/, ""))
      .pipe(
        z
          .string()
          .regex(/^[a-zA-Z0-9_]{3,32}$/, "Enter a valid Telegram handle.")
      )
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((d) => Boolean(d.email || d.telegramHandle), {
    message: "Provide an email or a Telegram handle.",
  });
export type ReportDeliverInput = z.infer<typeof ReportDeliverInputSchema>;
