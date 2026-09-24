/**
 * @jest-environment node
 */

// next/server's NextRequest needs the real (undici-backed) Request/Response
// globals Node provides — jsdom (this project's default test environment,
// see jest.config.js) doesn't implement them, so this file opts back into
// the node environment on its own via the docblock pragma above.
import { NextRequest } from "next/server";
import { IDENTIFYING_REQUEST_HEADERS, proxy } from "../proxy";

// Signs a minimal (unverified — proxy.ts only ever decodes, never verifies,
// same as decodeAccessTokenClaims' own doc comment) JWT-shaped token with
// the given claims, so these tests don't need a real TokenService/secret.
function fakeAccessToken(claims: Record<string, unknown>): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64(claims)}.sig`;
}

function requestTo(path: string, cookie?: string): NextRequest {
  const headers: HeadersInit = cookie ? { cookie: `iwtr_access=${cookie}` } : {};
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

describe("proxy (admin route gate)", () => {
  it("redirects to / and sets the forbidden-notice cookie when there's no access-token cookie at all", () => {
    const res = proxy(requestTo("/admin/dashboard"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
    expect(res.cookies.get("iwtr_forbidden_notice")?.value).toBe("1");
  });

  it("redirects a non-admin (MEMBER) role away from /admin/*", () => {
    const token = fakeAccessToken({ role: "MEMBER", exp: Math.floor(Date.now() / 1000) + 900 });
    const res = proxy(requestTo("/admin/dashboard", token));
    expect(res.status).toBe(307);
    expect(res.cookies.get("iwtr_forbidden_notice")?.value).toBe("1");
  });

  it("redirects an ADMIN whose token has already expired", () => {
    const token = fakeAccessToken({ role: "ADMIN", exp: Math.floor(Date.now() / 1000) - 10 });
    const res = proxy(requestTo("/admin/dashboard", token));
    expect(res.status).toBe(307);
  });

  it("lets a real, unexpired ADMIN token through, with no forbidden-notice cookie set", () => {
    const token = fakeAccessToken({ role: "ADMIN", exp: Math.floor(Date.now() / 1000) + 900 });
    const res = proxy(requestTo("/admin/dashboard", token));
    // NextResponse.next() carries no redirect Location and a 200-ish
    // "pass through" status.
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get("iwtr_forbidden_notice")).toBeUndefined();
  });
});

describe("proxy (review-traffic header stripping)", () => {
  function reviewRequest(path: string) {
    return new NextRequest(new URL(path, "http://localhost:3000"), {
      method: "POST",
      headers: {
        cookie: "iwtr_access=token-value",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        referer: "http://localhost:3000/companies/acme",
        "x-forwarded-for": "203.0.113.7",
        "accept-language": "tr-TR,tr;q=0.9",
        "sec-ch-ua-platform": "\"Windows\"",
      },
    });
  }

  // NextResponse.next({ request: { headers } }) tells Next which request
  // headers the downstream route handler sees via x-middleware-override-headers
  // (the full list of kept header names) plus one x-middleware-request-<name>
  // per kept header.
  function forwardedHeaderNames(res: Response): string[] {
    return (res.headers.get("x-middleware-override-headers") ?? "").split(",").filter(Boolean);
  }

  it.each(["/api/proxy/reviews", "/api/proxy/reviews/abc/vote"])(
    "drops every identifying header on %s but keeps the session cookie and content type",
    (path) => {
      const res = proxy(reviewRequest(path));
      const kept = forwardedHeaderNames(res);

      for (const name of IDENTIFYING_REQUEST_HEADERS) expect(kept).not.toContain(name);
      expect(kept).toEqual(expect.arrayContaining(["cookie", "content-type"]));
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      expect(res.headers.get("cache-control")).toBe("no-store");
      // Review traffic is never mistaken for an /admin route.
      expect(res.headers.get("location")).toBeNull();
    },
  );
});
