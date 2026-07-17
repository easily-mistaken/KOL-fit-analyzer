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
            "linear-gradient(180deg, rgba(var(--field-veil),0.46), rgba(var(--field-veil),0.2) 34%, rgba(var(--field-veil),0.55))",
        }}
      />

      <div className="pointer-events-none relative flex flex-col items-center gap-8 px-4 py-12 sm:py-16">
        <div className="max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-secondary-foreground">
            <span className="h-2 w-2 rounded-[2px] bg-accent-primary" />
            Audience intelligence
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-[52px] sm:leading-[1.02]">
            Know who actually listens
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-secondary-foreground">
            Followers are cheap to buy. Before you pay a creator, find out
            whether the people who actually engage with them are the people you
            want to reach.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Every lit dot below is an account that engages. Move your cursor to
            find more.
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
