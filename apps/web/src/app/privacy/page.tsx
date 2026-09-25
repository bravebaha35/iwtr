import type { Metadata } from "next";
import { LegalPage, SUPPORT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How I Worked There keeps reviewers anonymous: what we collect, why, how it's protected, and your rights under KVKK.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="25 September 2026"
      intro={
        <p>
          I Worked There lets you rate past employers anonymously. To stop fake reviews we have to know you are a
          real person, but we keep that proof completely separate from what you write. This page explains what we
          collect, why, and what we never do with it. It is written to meet the Turkish Personal Data Protection Law
          (KVKK, Law No. 6698).
        </p>
      }
      sections={[
        {
          id: "what-we-collect",
          heading: "What we collect",
          body: (
            <ul>
              <li>
                <strong>Account details:</strong> your email address and a password. We only ever store the password
                as a one-way hash.
              </li>
              <li>
                <strong>Identity proof:</strong> your name, birth date, city, phone number and T.C. Kimlik Numarası.
                These are encrypted in a separate, locked-down store. They are never shown to anyone and never attached
                to your reviews.
              </li>
              <li>
                <strong>Work and education history</strong> that you enter, so we can check you actually worked
                where you leave a review.
              </li>
              <li>
                <strong>Reviews, comments and private messages</strong> you write.
              </li>
              <li>
                <strong>Optional salary and benefits answers,</strong> only if you tick the consent box when you
                submit a review.
              </li>
            </ul>
          ),
        },
        {
          id: "anonymity",
          heading: "How we keep you anonymous",
          body: (
            <>
              <p>
                Reviews and comments appear only under your anonymous review name, or under a one-off random name if you
                choose that. Employers see scores and anonymous text, never who wrote them.
              </p>
              <p>
                Review, message and publication dates are stored to the <strong>day only</strong>, never the exact
                time, so nobody can line a post up against who was at work at that moment.
              </p>
              <p>
                When you submit a review or send a private message, your browser details (device, language, the page you
                came from, network address) are stripped before the request reaches our servers.
              </p>
              <p>
                Your T.C. Kimlik Numarası is <strong>deleted</strong> as soon as your first review is published. We
                keep only a one-way fingerprint of it, which cannot be turned back into the number. We use it only to
                stop the same person from opening several accounts.
              </p>
            </>
          ),
        },
        {
          id: "messages",
          heading: "Private messages with companies",
          body: (
            <p>
              If a company publicly replies to your review, you can choose to message it privately. The company only
              ever sees the name shown on your review. Messages are checked automatically for names, phone numbers
              and abuse before they are delivered. Either side can end a conversation at any time, permanently.
            </p>
          ),
        },
        {
          id: "salary",
          heading: "Salary and benefits statistics",
          body: (
            <p>
              If you agree, your salary and benefits answers are combined with many others into sector statistics
              that companies can buy as a report. A figure is only ever shown when it covers at least 5
              different people across at least 3 different companies. Salaries are rounded into bands, and no
              individual answer, name or review is ever included. You can use the platform fully without sharing
              this.
            </p>
          ),
        },
        {
          id: "cookies",
          heading: "Cookies and similar technology",
          body: (
            <>
              <p>
                <strong>Essential:</strong> secure, http-only cookies keep you signed in. Your browser also remembers
                display settings such as light or dark mode, and your cookie choice. These don&apos;t need consent.
              </p>
              <p>
                <strong>Analytics (optional):</strong> only if you click &ldquo;Accept&rdquo; in the cookie banner, and
                only on public pages such as the homepage, company pages, jobs and IWT Social. Analytics never runs on
                your account pages, and it is switched off completely while the review form is open.
              </p>
            </>
          ),
        },
        {
          id: "legal-logs",
          heading: "Logs we are required to keep",
          body: (
            <p>
              Turkish Law No. 5651 requires us to keep basic traffic records for sign-up, sign-in and review
              submission. These records are encrypted, used only if a court or authority lawfully requires them, and
              never shared with employers.
            </p>
          ),
        },
        {
          id: "never",
          heading: "What we never do",
          body: (
            <ul>
              <li>Sell your personal data, or give it to employers, recruiters or agencies.</li>
              <li>Reveal who wrote a review, comment or message to a company.</li>
              <li>Show your identity details to other users.</li>
            </ul>
          ),
        },
        {
          id: "retention",
          heading: "How long we keep data",
          body: (
            <p>
              Your account data stays while your account is open. If you delete your account from Account Options, we
              delete your reviews, history and identity details. The only things we keep are the one-way ID-number
              fingerprint (to prevent duplicate accounts) and any logs the law requires.
            </p>
          ),
        },
        {
          id: "rights",
          heading: "Your rights (KVKK Article 11)",
          body: (
            <p>
              You can ask whether we process your data, get a copy, have it corrected or deleted, learn who it was
              shared with, and object to processing. Email {SUPPORT_EMAIL} and we will answer within 30 days. You may
              also complain to the Personal Data Protection Authority (KVKK Kurumu).
            </p>
          ),
        },
      ]}
    />
  );
}
