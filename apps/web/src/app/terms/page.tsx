import type { Metadata } from "next";
import { LegalPage, SUPPORT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The rules for reviewing, commenting, messaging and running a company page on I Worked There.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updated="25 September 2026"
      intro={
        <p>
          iworkedthere.com belongs to the people who do the work. You have the right to rate your employer anonymously
          and describe real working conditions. In return, you agree to the rules below. By creating an account or
          using the site you accept these terms.
        </p>
      }
      sections={[
        {
          id: "accounts",
          heading: "Your account",
          body: (
            <ul>
              <li>One person, one account. You must be at least 18 and give true identity details.</li>
              <li>Keep your password private. You are responsible for what happens under your account.</li>
              <li>You can freeze or delete your account at any time from Account Options.</li>
            </ul>
          ),
        },
        {
          id: "reviews",
          heading: "Writing reviews and comments",
          body: (
            <>
              <p>
                <strong>Criticise the company and how it works, never individual people.</strong> Don&apos;t include
                real names, phone numbers, job titles that point to one person, insults, hate speech, or anything
                illegal.
              </p>
              <ul>
                <li>You may only review a workplace that is in your own work history.</li>
                <li>One review per company. You can edit it later.</li>
                <li>Write about your own experience, honestly. Don&apos;t post fake or paid reviews.</li>
              </ul>
              <p>
                Every review is checked automatically and some are checked by a person before publishing. We may refuse
                or remove content that breaks these rules or the law.
              </p>
            </>
          ),
        },
        {
          id: "messages",
          heading: "Private messages",
          body: (
            <p>
              After a company publicly replies to your review, you may open one private conversation with it. The
              same content rules apply. Messages that contain names, contact details or abuse are not delivered.
              Either side may end a conversation at any time, and an ended conversation cannot be reopened. Companies
              may never try to find out who a reviewer is.
            </p>
          ),
        },
        {
          id: "companies",
          heading: "Company pages and paid plans",
          body: (
            <ul>
              <li>Only an authorised representative may claim a company page. Claims are verified before approval.</li>
              <li>Companies may reply publicly to reviews, but can&apos;t edit, hide or buy the removal of a review.</li>
              <li>
                Paid plans renew as described at checkout and can be cancelled before the next renewal. Payments are
                processed by our payment provider.
              </li>
              <li>Job postings must be real, lawful and non-discriminatory.</li>
            </ul>
          ),
        },
        {
          id: "takedown",
          heading: "Reporting unlawful content (Notice & Takedown)",
          body: (
            <p>
              We act as a hosting provider under Law No. 5651. If you believe content is unlawful (for example
              defamation or a leaked trade secret), email {SUPPORT_EMAIL} with the link and your reasons. We review
              every notice and remove content that is clearly unlawful. We will never hand a reviewer&apos;s identity
              to a complaining employer without a binding court order.
            </p>
          ),
        },
        {
          id: "ours",
          heading: "Your content and ours",
          body: (
            <p>
              You keep ownership of what you write. By posting it you allow us to display, store and moderate it on
              the platform, and to include it anonymously in aggregate scores. The I Worked There name, beaver mascot
              and site design belong to us.
            </p>
          ),
        },
        {
          id: "liability",
          heading: "Our responsibility",
          body: (
            <p>
              Reviews are the personal opinions of their authors, not statements by I Worked There. We work hard to
              keep the site accurate and available, but we provide it &ldquo;as is&rdquo; and are not liable for
              decisions you make based on it, to the extent the law allows.
            </p>
          ),
        },
        {
          id: "changes",
          heading: "Changes and governing law",
          body: (
            <p>
              We may update these terms. If a change is significant, we will tell you on the site before it takes
              effect. These terms are governed by the laws of the Republic of Türkiye, and the courts of İstanbul
              have jurisdiction.
            </p>
          ),
        },
      ]}
    />
  );
}
