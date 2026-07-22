import { AnalysisForm } from "@/components/analysis-form";

// The "About OverlapX" block below the form is not decoration: Google's OAuth
// verification rejects a homepage that does not state the app's purpose, and
// rejects an app name that does not appear on the homepage in the same form as
// the consent screen. The marketing headline ("Know who actually listens")
// satisfies neither on its own, so this says the plain thing plainly. Keep the
// literal string "OverlapX" and the sign-in explanation if you rewrite it.
function AboutOverlapX() {
  const steps = [
    "Enter two public X handles — your brand's and the creator's — plus any context about your product.",
    "OverlapX reads their public posts and the accounts that engage with them, then classifies that audience.",
    "You get a fit verdict with a score breakdown and the evidence behind it, so you can judge it yourself.",
  ];

  return (
    <section className="mx-auto mt-10 max-w-2xl space-y-5 border-t border-default px-4 pt-10">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          About OverlapX
        </h2>
        <p className="text-sm leading-relaxed text-secondary-foreground">
          OverlapX is an audience-analysis tool for brands deciding whether to
          pay a creator on X (Twitter). Follower counts say nothing about who is
          listening, so OverlapX looks at the accounts that actually engage with
          a creator and scores how well that audience matches the people you are
          trying to reach.
        </p>
      </div>

      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm text-secondary-foreground">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-primary text-[11px] font-semibold text-accent-contrast">
              {i + 1}
            </span>
            <span className="leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>

      <p className="text-sm leading-relaxed text-secondary-foreground">
        You can run analyses without an account. Signing in with Google is
        optional and is used only to identify you so your saved reports follow
        you across devices — OverlapX requests nothing from your Google account
        beyond your name and email address.
      </p>
    </section>
  );
}

export default function HomePage() {
  return (
    <section className="rounded-2xl border border-default bg-base">
      <div className="relative flex flex-col items-center gap-8 px-4 py-12 sm:py-16">
        <div className="max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-secondary-foreground">
            <span className="h-2 w-2 rounded-[2px] bg-accent-primary" />
            {/* The brand name stays in this line verbatim: Google's OAuth review
                checks the consent-screen app name is visible on the homepage. */}
            OverlapX · Audience intelligence
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-[52px] sm:leading-[1.02]">
            Know who actually listens
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-secondary-foreground">
            Followers are cheap to buy. Before you pay a creator, find out
            whether the people who actually engage with them are the people you
            want to reach.
          </p>
        </div>

        {/* focal point: the analysis form */}
        <div className="relative w-full max-w-2xl">
          <div className="pointer-events-none absolute -inset-3 rounded-[28px] bg-accent-primary/15 blur-2xl" />
          <div className="relative">
            <AnalysisForm />
          </div>
        </div>

        <AboutOverlapX />
      </div>
    </section>
  );
}
