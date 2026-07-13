import { getBoss } from "./boss.js";
import { QUEUE_NAMES } from "./constants.js";
import {
  AnalysisRunPayloadSchema,
  ReportDeliverPayloadSchema,
  type AnalysisRunPayload,
  type ReportDeliverPayload,
} from "./payloads.js";

/**
 * Enqueues an `analysis.run` job. Returns the pg-boss job id.
 * Throws if the queue is unreachable or pg-boss does not return a job id.
 */
export async function enqueueAnalysisRun(
  payload: AnalysisRunPayload
): Promise<string> {
  const data = AnalysisRunPayloadSchema.parse(payload);
  const boss = await getBoss();
  const id = await boss.send(QUEUE_NAMES.ANALYSIS_RUN, data);
  if (!id) {
    throw new Error("pg-boss returned no job id for analysis.run");
  }
  return id;
}

/**
 * Enqueues a `report.deliver` job. Returns the pg-boss job id.
 * Throws if the queue is unreachable or pg-boss does not return a job id.
 */
export async function enqueueReportDeliver(
  payload: ReportDeliverPayload
): Promise<string> {
  const data = ReportDeliverPayloadSchema.parse(payload);
  const boss = await getBoss();
  const id = await boss.send(QUEUE_NAMES.REPORT_DELIVER, data);
  if (!id) {
    throw new Error("pg-boss returned no job id for report.deliver");
  }
  return id;
}
