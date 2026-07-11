import { Sparkles } from "lucide-react";
import { APP_NAME } from "@kol-fit/shared";

import { AnalysisForm } from "@/components/analysis-form";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="mx-auto max-w-2xl space-y-4 pt-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-default bg-elevated px-3 py-1 text-xs text-secondary-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent-hover" />
          Engaged-audience fit analysis
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {APP_NAME}
        </h1>
        <p className="mx-auto max-w-xl text-base leading-relaxed text-secondary-foreground">
          We don&apos;t just check what a KOL posts — we check{" "}
          <span className="text-foreground">who actually listens</span>, and
          whether they&apos;re your audience.
        </p>
      </section>

      <AnalysisForm />
    </div>
  );
}
