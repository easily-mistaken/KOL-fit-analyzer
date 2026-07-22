import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { BackButton } from "@/components/back-button";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What OverlapX collects, why, who processes it, and how to have it deleted.",
};

// Privacy policy. Required by Google's OAuth consent screen, which must point at
// a page on the app's own verified domain — hence a real route here rather than
// a hosted document. Every claim below describes behaviour that exists in this
// codebase; if the data flow changes, this page changes with it.

const UPDATED = "22 July 2026";
const CONTACT_EMAIL = "tanmayjain5114@gmail.com";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-secondary-foreground">
        {children}
      </div>
    </section>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="ml-4 list-disc space-y-2 marker:text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <BackButton fallbackHref="/" label="Back" />

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-accent-ink">
          <ShieldCheck className="h-4 w-4" />
          Privacy
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="text-sm text-secondary-foreground">
          Last updated {UPDATED}. This policy covers overlapx.com and describes
          exactly what the product stores and who it sends data to.
        </p>
      </div>

      <div className="space-y-8 rounded-2xl border border-default bg-surface p-6 shadow-card sm:p-8">
        <Section title="What OverlapX does">
          <p>
            OverlapX analyses whether a public X (Twitter) creator is a good fit
            for a given brand. You give it two public handles and optional
            context about your product; it reads publicly available posts and
            engagement, and returns a fit report. You can use it without an
            account.
          </p>
        </Section>

        <Section title="Information we collect">
          <Bullets
            items={[
              <>
                <strong className="font-medium text-foreground">
                  Account information.
                </strong>{" "}
                If you sign in with Google, we receive and store your email
                address, plus the times you created the account and last signed
                in. We do not receive your Google password, contacts, Drive,
                Gmail, or any other Google data.
              </>,
              <>
                <strong className="font-medium text-foreground">
                  Analysis inputs.
                </strong>{" "}
                The handles you submit and any optional context you add —
                website URL, docs URL, product category, target user, campaign
                goal, stage, region — along with the resulting report.
              </>,
              <>
                <strong className="font-medium text-foreground">
                  Contact details you choose to give us.
                </strong>{" "}
                If you request a curated report, ask for a higher analysis
                allowance, or ask to be notified when a report is ready, we
                store what you enter: an email address, a Telegram handle, an X
                handle, or a short note.
              </>,
              <>
                <strong className="font-medium text-foreground">
                  A browser identifier.
                </strong>{" "}
                When you run an analysis without signing in, we set a
                random-value cookie so your reports come back to your browser
                and usage limits can be applied. It contains no personal
                information. If you later sign in, those reports are moved to
                your account.
              </>,
              <>
                <strong className="font-medium text-foreground">
                  Server logs.
                </strong>{" "}
                Our web server records standard request information, including
                IP address, timestamp, and requested page, which is used to
                operate and secure the service.
              </>,
            ]}
          />
        </Section>

        <Section title="Information about the accounts you analyse">
          <p>
            An analysis reads <em>publicly available</em> information about the
            X accounts you name — profile details, posts, and the public
            accounts that engaged with them — and stores a derived summary as
            part of your report. We do not access private or restricted content,
            and we do not use this to build advertising profiles or contact
            anyone.
          </p>
        </Section>

        <Section title="How we use it">
          <Bullets
            items={[
              "To run the analyses you request and show you the resulting reports.",
              "To keep your report history available across your devices when you sign in.",
              "To apply usage limits and prevent abuse of a service that costs real money per analysis.",
              "To reply to you when you have asked us to — a curated report, an allowance request, or a ready notification.",
              "To operate, debug, and secure the service.",
            ]}
          />
          <p>
            We do not sell your information, we do not share it with
            advertisers, and we do not use it for advertising of any kind.
          </p>
        </Section>

        <Section title="Google user data">
          <p>
            Google sign-in requests only your basic profile and email address.
            We use them for one purpose: to identify your account so your
            reports follow you across devices.
          </p>
          <p>
            OverlapX&apos;s use of information received from Google APIs adheres
            to the{" "}
            <a
              className="text-accent-ink underline underline-offset-2"
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. We do not transfer this
            data to others except as needed to provide the service, and never
            for advertising, credit assessment, or resale. We do not use it to
            train generalised AI or machine-learning models.
          </p>
        </Section>

        <Section title="Service providers">
          <p>
            We keep the list short and name every one of them:
          </p>
          <Bullets
            items={[
              <>
                <strong className="font-medium text-foreground">Supabase</strong>{" "}
                — authentication and our database, where accounts, analyses, and
                reports are stored.
              </>,
              <>
                <strong className="font-medium text-foreground">
                  TwitterAPI.io
                </strong>{" "}
                — retrieves the public X data an analysis is based on. It
                receives the handles being analysed.
              </>,
              <>
                <strong className="font-medium text-foreground">OpenAI</strong>{" "}
                — classifies and summarises that public content and the context
                you provide. Sent through their API, which does not use the data
                to train their models.
              </>,
              <>
                <strong className="font-medium text-foreground">RackNerd</strong>{" "}
                — the server the application runs on.
              </>,
              <>
                <strong className="font-medium text-foreground">Telegram</strong>{" "}
                — used to alert the operator to new requests, and to deliver a
                curated report if you asked for one that way.
              </>,
            ]}
          />
          <p>
            We may also disclose information where we are legally required to do
            so.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use cookies that are strictly necessary to run the service: a
            session cookie once you sign in, and the anonymous browser
            identifier described above. We use no advertising cookies and no
            third-party analytics or tracking cookies.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Accounts and their reports are kept while the account exists. The
            anonymous browser cookie expires one year after it is set. Contact
            details you submit for a curated report or an allowance request are
            kept until that request is handled and for a reasonable period
            afterwards. Ask us to delete any of it and we will.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            Email{" "}
            <a
              className="text-accent-ink underline underline-offset-2"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>{" "}
            to get a copy of the information we hold about you, correct it, or
            have your account and reports deleted. We will action deletion
            requests within 30 days. You can also revoke OverlapX&apos;s access
            to your Google account at any time from your{" "}
            <a
              className="text-accent-ink underline underline-offset-2"
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google account permissions
            </a>{" "}
            page, and you can clear the anonymous cookie by clearing site data in
            your browser.
          </p>
        </Section>

        <Section title="Children">
          <p>
            OverlapX is a business tool and is not directed to anyone under 16.
            We do not knowingly collect information from children.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If this policy changes, the date at the top changes with it.
            Material changes will be signalled in the app.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or about your data:{" "}
            <a
              className="text-accent-ink underline underline-offset-2"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
