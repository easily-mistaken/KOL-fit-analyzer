import { Sparkles } from "lucide-react";
import { APP_NAME } from "@kol-fit/shared";

import { AnalysisForm } from "@/components/analysis-form";
import { AudienceField } from "@/components/audience-field";

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Interactive hero — the "who actually listens" audience field */}
      <section className="relative overflow-hidden rounded-2xl border border-default bg-surface shadow-card">
        <AudienceField className="absolute inset-0 h-full w-full" />
        {/* readability veil + focus glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 0%, transparent 30%, rgba(21,24,26,0.55) 78%), linear-gradient(to bottom, rgba(21,24,26,0.35), rgba(21,24,26,0.15))",
          }}
        />
        <div className="pointer-events-none relative flex flex-col items-center gap-4 px-6 py-16 text-center sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-default bg-elevated/70 px-3 py-1 text-xs text-secondary-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-accent-hover" />
            Engaged-audience fit analysis
          </span>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-[42px] sm:leading-[1.05]">
            {APP_NAME}
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-secondary-foreground">
            We don&apos;t just check what a KOL posts — we check{" "}
            <span className="text-foreground">who actually listens</span>, and
            whether they&apos;re your audience.
          </p>
          <p className="text-xs text-muted-foreground">
            Move your cursor — the blue accounts are the ones that truly engage.
          </p>
        </div>
      </section>

      <AnalysisForm />
    </div>
  );
}
