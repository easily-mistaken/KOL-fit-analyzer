import type { Metadata } from "next";

import {
  LegalBullets,
  LegalPage,
  LegalSection,
  LegalTerm,
} from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The rules for using OverlapX, and what its reports are and are not.",
};

// Terms of service. Paired with /privacy for the Google OAuth consent screen.
// The section that actually matters for this product is "What a report is" —
// OverlapX publishes automated judgements about real people's public accounts,
// and users spend real money on the strength of them.

const UPDATED = "22 July 2026";
const CONTACT_EMAIL = "tanmayjain5114@gmail.com";

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      icon="scale"
      title="Terms of Service"
      updated={UPDATED}
      intro="These terms cover overlapx.com. Using the site means you accept them."
    >
      <LegalSection title="What OverlapX is">
        <p>
          OverlapX analyses whether a public X (Twitter) creator is a plausible
          fit for a given brand. You submit two public handles and optional
          context; it reads public posts and engagement, scores the pair, and
          returns a report. It is run by an individual, not a company.
        </p>
      </LegalSection>

      <LegalSection title="Using it">
        <p>
          You can run analyses without an account. Signing in with Google keeps
          your reports across devices. Keep your Google account secure.
          Anything done through a signed-in session is treated as done by you.
        </p>
        <p>
          You need to be at least 16, and if you are using OverlapX for a
          company, you need the authority to accept these terms on its behalf.
        </p>
      </LegalSection>

      <LegalSection title="Allowances">
        <p>
          Each analysis costs real money in third-party data and model calls, so
          use is capped. The app shows your remaining allowance and what happens
          when it runs out. You can ask for a higher allowance in the app; we
          may grant, refuse, or reverse that, and we may change the limits as
          costs change.
        </p>
        <p>
          Do not work around the caps: no clearing cookies to reset an
          allowance, no multiple accounts for the same purpose, no scripted
          submissions.
        </p>
      </LegalSection>

      <LegalSection title="What a report is, and what it is not">
        <p>
          A report is an automated estimate. It is produced by models and
          scoring rules reading public data at one moment in time, and it can be
          wrong: about the audience, about the creator, about the fit. Handles
          with little public activity, or accounts our data provider cannot
          read, produce weaker results, and the report says so when it can tell.
        </p>
        <p>
          Treat a report as one input to your own judgement. It is not
          professional, financial, or legal advice, and it is not a statement of
          fact about any person. Verify anything that matters before you spend
          money or make a public claim. Decisions you take after reading a
          report are yours.
        </p>
      </LegalSection>

      <LegalSection title="The accounts you analyse">
        <p>
          OverlapX reads publicly available information about the handles you
          submit. You are responsible for having a legitimate business reason to
          analyse them and for complying with the law where you are.
        </p>
        <p>Do not use OverlapX or anything it produces to:</p>
        <LegalBullets
          items={[
            "harass, defame, or target an individual;",
            "make public claims about a person or their audience as though they were verified fact;",
            "build a dataset or profile about individuals unrelated to evaluating a partnership;",
            "do anything that breaks X's terms or applicable law.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Curated reports">
        <p>
          You can request a hand-curated report, which a person reviews and
          sends back over Telegram or email. Turnaround is a best effort, not a
          guarantee. These are free today. If that ever changes, the price will
          be shown before you commit to anything, and these terms will be
          updated.
        </p>
      </LegalSection>

      <LegalSection title="Fair use of the service">
        <LegalBullets
          items={[
            <>
              <LegalTerm>Do not automate it.</LegalTerm> No scraping, crawling,
              or scripted submission against the site or its API.
            </>,
            <>
              <LegalTerm>Do not resell it.</LegalTerm> Use reports for your own
              business decisions. Do not repackage them as your own product or
              service.
            </>,
            <>
              <LegalTerm>Do not attack it.</LegalTerm> No attempts to break,
              overload, or gain unauthorised access to the service or the data
              in it.
            </>,
            <>
              <LegalTerm>Do not misrepresent it.</LegalTerm> Do not present a
              report as something other than an automated analysis.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Your content and ours">
        <p>
          What you submit stays yours. You grant permission to process it for
          the purpose of producing your reports and running the service. The
          reports you generate are yours to use in your business.
        </p>
        <p>
          The site, its scoring approach, and its software remain ours. Nothing
          here transfers that.
        </p>
      </LegalSection>

      <LegalSection title="Availability">
        <p>
          OverlapX is operated by one person and depends on third parties:
          Supabase for auth and database, a data provider for X content, OpenAI
          for classification. Any of them can be slow, rate-limited, or down,
          and that will affect results. There is no uptime guarantee. Features
          may change or be withdrawn.
        </p>
      </LegalSection>

      <LegalSection title="No warranty">
        <p>
          The service is provided as is, without warranties of any kind, express
          or implied, including accuracy, fitness for a particular purpose, or
          uninterrupted availability.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          To the extent the law allows, OverlapX is not liable for indirect or
          consequential losses, lost profits, lost opportunities, or wasted
          marketing spend arising from your use of the service or reliance on a
          report. Where liability cannot be excluded, it is limited to the
          amount you paid in the twelve months before the claim. While the
          service is free, that is nothing.
        </p>
        <p>
          Nothing here limits liability for fraud or for anything else that
          cannot lawfully be limited.
        </p>
      </LegalSection>

      <LegalSection title="Suspension">
        <p>
          Accounts that break these terms, abuse the allowances, or drive costs
          in bad faith can be suspended or removed without notice. You can stop
          using OverlapX at any time and ask for your account and reports to be
          deleted.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          These terms can change. The date at the top changes with them, and
          continuing to use the service means you accept the current version.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions, complaints, or deletion requests:{" "}
          <a
            className="text-accent-ink underline underline-offset-2"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          . How data is handled is set out in the{" "}
          <a
            className="text-accent-ink underline underline-offset-2"
            href="/privacy"
          >
            privacy policy
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
