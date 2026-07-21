import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, TrendingUp } from "lucide-react";

import { nextLimitTier, resolveTierLimits } from "@kol-fit/shared";
import { prisma } from "@kol-fit/db";

import { getCurrentUser } from "@/lib/auth";
import { getOwnerId } from "@/lib/owner";
import { getUserAnalysisLimit } from "@/lib/tier-gate";
import { BackButton } from "@/components/back-button";
import { LimitRequestForm } from "@/components/limit-request-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Request more analyses" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Self-serve allowance-raise (Unit 47). Reachable from the tier wall. Signed-in
// only — a raised allowance lives on the account, so anonymous visitors are
// asked to sign in first (the wall already routes them there).
export default async function UpgradePage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackButton fallbackHref="/" label="Back" />
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-accent-ink">
          <TrendingUp className="h-4 w-4" />
          Keep going
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Unlock more analyses
        </h1>
        <p className="max-w-xl text-sm text-secondary-foreground">
          Run out and want to keep comparing creators? Ask for the next tier and
          we&apos;ll approve it — usually within a day.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request an upgrade</CardTitle>
          <CardDescription>
            Tell us how to reach you and we&apos;ll bump your limit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UpgradeBody user={user} />
        </CardContent>
      </Card>
    </div>
  );
}

async function UpgradeBody({
  user,
}: {
  user: Awaited<ReturnType<typeof getCurrentUser>>;
}) {
  // Signed-in only — a durable allowance needs a real account.
  if (!user) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-secondary-foreground">
          Sign in with Google first — your raised limit (and your history) lives
          with your account, so it&apos;s there on every device.
        </p>
        <Button asChild>
          <Link href="/login">Sign in to continue</Link>
        </Button>
      </div>
    );
  }

  const ownerId = await getOwnerId();
  const base = resolveTierLimits(process.env);
  const currentLimit = ownerId
    ? await getUserAnalysisLimit(ownerId, base.userLifetime)
    : base.userLifetime;
  const requestedLimit = nextLimitTier(currentLimit);

  // Already at the top of the self-serve ladder.
  if (requestedLimit === null) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-secondary-foreground">
          You&apos;re already at the highest self-serve tier ({currentLimit}{" "}
          analyses). For a deeper, hand-curated look, request a detailed report.
        </p>
        <Button asChild variant="outline">
          <Link href="/detailed">Request a curated report</Link>
        </Button>
      </div>
    );
  }

  // A pending request already exists — don't invite a duplicate.
  const pending = ownerId
    ? await prisma.limitRaiseRequest.findFirst({
        where: { ownerId, status: "PENDING" },
        select: { requestedLimit: true },
      })
    : null;
  if (pending) {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-4 text-sm">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-accent-ink" />
          You already have a request in review
        </div>
        <p className="mt-1.5 text-secondary-foreground">
          We&apos;re on it — you&apos;ll be unlocked to {pending.requestedLimit}{" "}
          analyses soon. Thanks for your patience.
        </p>
      </div>
    );
  }

  return (
    <LimitRequestForm
      currentLimit={currentLimit}
      requestedLimit={requestedLimit}
      accountEmail={user.email}
    />
  );
}
