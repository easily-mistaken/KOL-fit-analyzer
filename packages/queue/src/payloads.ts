import { z } from "zod";

// Payload for the `analysis.run` job. Validated on enqueue (here) and again on
// the consume side in Unit 07 (Invariant 9).
export const AnalysisRunPayloadSchema = z.object({
  requestId: z.string(), // AnalysisRequest.id (canonical id)
  jobId: z.string(), // AnalysisJob.id (so the worker can update the exact row)
});

export type AnalysisRunPayload = z.infer<typeof AnalysisRunPayloadSchema>;
