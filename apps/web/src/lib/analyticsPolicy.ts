export type CookieConsent = "accepted" | "declined" | null;

// Public, browse-only parts of the site. Everything else — account pages,
// the owner dashboard, admin, API routes — never runs analytics.
const PUBLIC_SECTIONS = ["/social", "/jobs", "/companies", "/privacy", "/terms"];

/**
 * The one rule deciding whether an analytics script may run. It needs all
 * three: an explicit "Accept" in the cookie banner, a public page, and the
 * anonymous review form closed. That last one is the firewall that keeps
 * an analytics tool from ever lining up "who was on this page" with "who
 * just wrote this review".
 */
export function analyticsAllowed(opts: {
  consent: CookieConsent;
  pathname: string;
  reviewFlowActive: boolean;
}): boolean {
  if (opts.consent !== "accepted" || opts.reviewFlowActive) return false;
  if (opts.pathname === "/") return true;
  return PUBLIC_SECTIONS.some((section) => opts.pathname === section || opts.pathname.startsWith(`${section}/`));
}
