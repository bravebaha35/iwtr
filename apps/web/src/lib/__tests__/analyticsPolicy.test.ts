import { analyticsAllowed } from "../analyticsPolicy";

const base = { consent: "accepted" as const, reviewFlowActive: false };

describe("analyticsAllowed", () => {
  it.each(["/", "/social", "/social/trending", "/jobs", "/companies/acme", "/privacy", "/terms"])(
    "allows public page %s once the visitor has accepted",
    (pathname) => {
      expect(analyticsAllowed({ ...base, pathname })).toBe(true);
    },
  );

  it("never runs without an explicit accept", () => {
    expect(analyticsAllowed({ ...base, consent: null, pathname: "/" })).toBe(false);
    expect(analyticsAllowed({ ...base, consent: "declined", pathname: "/" })).toBe(false);
  });

  it("is switched off while the anonymous review form is open, even on a public page", () => {
    expect(analyticsAllowed({ ...base, reviewFlowActive: true, pathname: "/companies/acme" })).toBe(false);
  });

  it.each(["/me", "/me/reviews", "/my/companies", "/admin/content", "/api/proxy/reviews", "/socialite"])(
    "never runs on private or unknown page %s",
    (pathname) => {
      expect(analyticsAllowed({ ...base, pathname })).toBe(false);
    },
  );
});
