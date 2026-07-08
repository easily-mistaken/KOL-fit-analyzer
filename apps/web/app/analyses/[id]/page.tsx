import { Clock } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// TEMPORARY placeholder landing page — the destination of the analysis form's
// post-submit redirect. It only confirms the analysis was created. The real
// polling status view and report rendering are Unit 09 / Unit 15; this page is
// replaced then. No polling, no data fetch, no report rendering here.
export default async function AnalysisStatusPlaceholderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-elevated text-accent-hover">
            <Clock className="h-5 w-5" />
          </span>
          <CardTitle className="text-base text-foreground">
            Analysis queued
          </CardTitle>
          <CardDescription>
            Your analysis request was created and is queued for processing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          <div className="text-xs text-muted-foreground">
            Request ID
            <div className="mt-1 font-mono text-sm text-secondary-foreground">
              {id}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Live status and the full report will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
