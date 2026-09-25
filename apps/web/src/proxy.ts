import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, decodeAccessTokenClaims } from "@/lib/server-auth";

// The real RBAC boundary is server-side (RolesGuard + @Roles("ADMIN") on
// every admin-companies/admin-queue/owner-claims route — see
// apps/api/src/common/guards/roles.guard.ts): a non-admin's data requests
// already get a 403 from apps/api no matter what happens here. This proxy
// (Next.js 16's renamed middleware convention) is the UX layer on top of
// that — it stops a non-admin from even seeing the /admin/* page shell,
// instead of letting it render and then silently fail to load anything.
//
// Reads the access-token cookie directly (same decodeAccessTokenClaims
// helper /api/session uses) rather than calling the API, so this can run on
// every /admin/* request with no extra round trip. A stale/expired access
// token reads the same as "not an admin" here — the worst case is an
// admin's client-side session getting silently refreshed a moment later by
// the normal fetch retry-after-401 path, then re-navigating; it never lets
// a non-admin through.
function gateAdminRoute(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  const claims = token ? decodeAccessTokenClaims(token) : null;
  const isExpired = claims ? claims.exp * 1000 < Date.now() : true;

  if (!claims || isExpired || claims.role !== "ADMIN") {
    const res = NextResponse.redirect(new URL("/", req.url));
    // A short-lived cookie rather than a "?error=forbidden" query param —
    // see ForbiddenBanner's doc comment for why: Next's client router was
    // observed reconciling the address bar back down to a bare "/" before
    // React ever got to read the query string.
    res.cookies.set("iwtr_forbidden_notice", "1", { path: "/", maxAge: 30 });
    return res;
  }

  return NextResponse.next();
}

// Request headers that describe the reviewer's device, network or the page
// they came from. None of them are needed to submit or vote on a review, so
// review traffic drops them here, before the proxy route handler (and
// anything it might log) ever sees them. The route handler itself also
// forwards only Content-Type + Authorization to apps/api — this is the
// belt to that pair of braces.
export const IDENTIFYING_REQUEST_HEADERS = [
  "user-agent",
  "referer",
  "x-forwarded-for",
  "x-real-ip",
  "forwarded",
  "accept-language",
  "dnt",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
] as const;

// Spam trap for the anonymous review form (RateButton.tsx): a hidden field
// real people never see or fill, plus how long the form was open. Checked
// here, before the request reaches apps/api, so a rejected bot submission
// is never logged anywhere and nothing about the sender is kept. Both
// headers are then removed so the API never sees them either.
export const FORM_TRAP_HEADER = "x-form-trap";
export const FORM_AGE_HEADER = "x-form-age-ms";
// Nobody answers 25 questions in under five seconds.
const MIN_FORM_AGE_MS = 5_000;

function isTrappedSubmission(req: NextRequest): boolean {
  const trap = req.headers.get(FORM_TRAP_HEADER);
  const age = req.headers.get(FORM_AGE_HEADER);
  if (trap) return true;
  if (age !== null && !(Number(age) >= MIN_FORM_AGE_MS)) return true;
  return false;
}

// Review and private-conversation traffic: the two flows where who's
// talking must never be recoverable.
function isAnonymousTraffic(pathname: string): boolean {
  return (
    pathname.startsWith("/api/proxy/reviews") ||
    pathname.startsWith("/api/proxy/conversations") ||
    pathname === "/api/proxy/me/conversations" ||
    /^\/api\/proxy\/owner\/companies\/[^/]+\/conversations$/.test(pathname)
  );
}

function stripReviewTraffic(req: NextRequest) {
  if (isTrappedSubmission(req)) {
    return NextResponse.json({ message: "Your review couldn't be submitted. Please try again." }, { status: 400 });
  }
  const headers = new Headers(req.headers);
  for (const name of IDENTIFYING_REQUEST_HEADERS) headers.delete(name);
  headers.delete(FORM_TRAP_HEADER);
  headers.delete(FORM_AGE_HEADER);
  const res = NextResponse.next({ request: { headers } });
  // Never cached anywhere, and never leaks this URL onward as a Referer.
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

// HTTPS only in production, so an anonymous session can never be
// downgraded to plain HTTP. The TLS-terminating host in front of Next
// reports the original scheme in X-Forwarded-Proto. (HSTS itself is sent
// on every response by next.config.ts's headers().)
function httpsRedirect(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  // A local production run (next start on localhost) has no TLS in front.
  if (["localhost", "127.0.0.1", "[::1]"].includes(req.nextUrl.hostname)) return null;
  const proto = (req.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  if (proto !== "http") return null;
  const url = req.nextUrl.clone();
  url.protocol = "https:";
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export function proxy(req: NextRequest) {
  const redirect = httpsRedirect(req);
  if (redirect) return redirect;
  const { pathname } = req.nextUrl;
  if (isAnonymousTraffic(pathname)) return stripReviewTraffic(req);
  if (pathname.startsWith("/admin")) return gateAdminRoute(req);
  return NextResponse.next();
}

export const config = {
  // Every page and API route (for the HTTPS redirect), minus Next's own
  // static files and image optimizer, which never carry a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image).*)"],
};
