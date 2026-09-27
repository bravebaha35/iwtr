import { JobPostingsController } from "../../job-postings/job-postings.controller";
import { RivalAnalyticsController } from "../../rival-analytics/rival-analytics.controller";
import { PaymentsController } from "../payments.controller";

// The three iyzico return routes are public (the payer's browser lands on
// them), so the body is untrusted: only a plain string token may ever reach
// the server-side status lookup, and the browser is always redirected back.
describe("public checkout callbacks", () => {
  const res = () => ({ redirect: jest.fn() }) as any;

  const cases = [
    {
      name: "Plus subscription",
      method: "callback",
      build: (fn: jest.Mock) => new PaymentsController({ handleCheckoutCallback: fn } as any),
    },
    {
      name: "job posting boost",
      method: "boostCheckoutCallback",
      build: (fn: jest.Mock) => new JobPostingsController({ completeCheckout: fn } as any),
    },
    {
      name: "rival analytics",
      method: "callback",
      build: (fn: jest.Mock) => new RivalAnalyticsController({ completeCheckout: fn } as any),
    },
  ];

  it.each(cases)("$name: passes a string token on and redirects", async ({ method, build }) => {
    const lookup = jest.fn().mockResolvedValue(undefined);
    const r = res();
    await (build(lookup) as any)[method]({ token: "tok_123" }, r);
    expect(lookup).toHaveBeenCalledWith("tok_123");
    expect(r.redirect).toHaveBeenCalledTimes(1);
  });

  it.each(cases)("$name: ignores a non-string or oversized token but still redirects", async ({ method, build }) => {
    for (const body of [{ token: { $ne: null } }, { token: ["a"] }, { token: "x".repeat(257) }, {}, undefined]) {
      const lookup = jest.fn();
      const r = res();
      await (build(lookup) as any)[method](body, r);
      expect(lookup).not.toHaveBeenCalled();
      expect(r.redirect).toHaveBeenCalledTimes(1);
    }
  });
});
