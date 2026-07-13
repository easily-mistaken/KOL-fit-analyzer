import { Sparkles } from "lucide-react";
import { APP_NAME } from "@kol-fit/shared";

import { AnalysisForm } from "@/components/analysis-form";
import { AudienceField } from "@/components/audience-field";

export default function HomePage() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-default bg-base">
      {/* the live "who actually listens" audience field */}
      <AudienceField className="absolute inset-0 h-full w-full" />
      {/* light legibility veil — keeps the field visible, text readable */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(21,24,26,0.42), rgba(21,24,26,0.18) 34%, rgba(21,24,26,0.5))",
        }}
      />

      <div className="pointer-events-none relative flex flex-col items-center gap-8 px-4 py-12 sm:py-16">
        <div className="max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-default bg-elevated/70 px-3 py-1 text-xs text-secondary-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-accent-hover" />
            Engaged-audience fit analysis
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-[42px] sm:leading-[1.05]">
            {APP_NAME}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-secondary-foreground">
            We don&apos;t just check what a KOL posts — we check{" "}
            <span className="text-foreground">who actually listens</span>. The
            blue accounts below engage; move your cursor to find more.
          </p>
        </div>

        {/* focal point: the analysis form, lifted onto the field */}
        <div className="pointer-events-auto relative w-full max-w-2xl">
          <div className="pointer-events-none absolute -inset-3 rounded-[28px] bg-accent-primary/15 blur-2xl" />
          <div className="relative">
            <AnalysisForm />
          </div>
        </div>
      </div>
    </section>
  );
}
