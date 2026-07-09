import { AnalysisStatus } from "@/components/analysis-status";

// Status page for one analysis. Reads the id and delegates all fetching,
// polling, and rendering to the client <AnalysisStatus> component, which reads
// saved DB state through GET /api/analyses/[id].
export default async function AnalysisStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AnalysisStatus id={id} />;
}
