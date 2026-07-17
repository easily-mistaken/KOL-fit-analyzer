import type { Metadata } from "next";
import { UserCheck } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { DetailedRequestForm } from "@/components/detailed-request-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Request a curated report" };

// Detailed-report concierge page (Unit 35). Reachable at any time — from the
// nav-level CTAs, a completed report ("get this one curated", which prefills
// the pair), or the Unit 34 upgrade wall.
export default async function DetailedRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; kol?: string; analysis?: string }>;
}) {
  const { org, kol, analysis } = await searchParams;
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-accent-hover">
          <UserCheck className="h-4 w-4" />
          Curated by an analyst
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Request a detailed, hand-curated report
        </h1>
        <p className="max-w-xl text-sm text-secondary-foreground">
          Beyond the automated analysis: a human analyst reviews the
          creator&apos;s audience, content, and risks in depth, then sends you a
          curated verdict on Telegram within a day.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where should we send it?</CardTitle>
          <CardDescription>
            We&apos;ll DM the report to your Telegram. Your X handle tells us
            who we&apos;re working with.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DetailedRequestForm
            defaultOrgHandle={org}
            defaultKolHandle={kol}
            analysisRequestId={analysis}
            isAuthenticated={Boolean(user)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
