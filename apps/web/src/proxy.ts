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
export function proxy(req: NextRequest) {
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

export const config = {
  matcher: ["/admin/:path*"],
};
