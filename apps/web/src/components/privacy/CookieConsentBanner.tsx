"use client";

import Link from "next/link";
import { setConsent, useConsent } from "@/lib/consent";

/**
 * Bottom-fixed, edge-to-edge consent bar. Only analytics depends on it
 * (sign-in cookies are strictly necessary and don't need consent); nothing
 * optional loads until "Accept", and never on account pages or while the
 * review form is open (see lib/analyticsPolicy.ts).
 */
export function CookieConsentBanner() {
  const consent = useConsent();
  // Rendered on the server too (consent unknown = undefined), so the bar is
  // part of the first paint instead of popping in after JavaScript loads.
  // For a visitor who already chose, layout.tsx's boot script marks <html>
  // before paint and globals.css hides the bar until React removes it.
  if (consent === "accepted" || consent === "declined") return null;

  return (
    <section
      id="cookie-consent"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface text-foreground"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-snug">
          We use essential cookies to keep you signed in. With your OK we&apos;d also measure how public pages are
          used — never on your account pages or while you write a review.{" "}
          <Link href="/privacy" className="font-semibold underline underline-offset-2">
            Read our privacy policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setConsent("declined")}
            className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-muted"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => setConsent("accepted")}
            className="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Accept
          </button>
        </div>
      </div>
    </section>
  );
}
