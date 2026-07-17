// pg-boss queue names. Matches architecture.md -> Background Job Model.
export const QUEUE_NAMES = {
  ANALYSIS_RUN: "analysis.run",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
