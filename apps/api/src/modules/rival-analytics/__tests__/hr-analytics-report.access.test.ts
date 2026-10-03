import { decideHrReportAccess, nextQuotaReset, quotaMonthKey } from "../hr-analytics-report.access";

const base = { planStatus: "ACTIVE" as const, quotaUsedThisMonth: false, hasPaidCredit: false };

describe("decideHrReportAccess", () => {
  it("includes the report for Enterprise, every time", () => {
    expect(decideHrReportAccess({ ...base, tier: "ENTERPRISE", quotaUsedThisMonth: true })).toBe("INCLUDED");
  });

  it("gives Pro one report a month, then asks for payment", () => {
    expect(decideHrReportAccess({ ...base, tier: "BLUE_PLUS" })).toBe("MONTHLY_QUOTA");
    expect(decideHrReportAccess({ ...base, tier: "BLUE_PLUS", quotaUsedThisMonth: true })).toBe("PAYMENT_REQUIRED");
  });

  it("asks Free and Starter to pay", () => {
    expect(decideHrReportAccess({ ...base, tier: "FREE" })).toBe("PAYMENT_REQUIRED");
    expect(decideHrReportAccess({ ...base, tier: "BLUE" })).toBe("PAYMENT_REQUIRED");
  });

  it("treats a lapsed paid plan as Free", () => {
    expect(decideHrReportAccess({ ...base, tier: "ENTERPRISE", planStatus: "PAST_DUE" })).toBe("PAYMENT_REQUIRED");
    expect(decideHrReportAccess({ ...base, tier: "BLUE_PLUS", planStatus: "CANCELED" })).toBe("PAYMENT_REQUIRED");
  });

  it("rebuilds a failed paid report for free", () => {
    expect(decideHrReportAccess({ ...base, tier: "BLUE", hasPaidCredit: true })).toBe("PAID_CREDIT");
  });
});

describe("quota month", () => {
  it("keys by UTC calendar month and refills on the 1st of the next", () => {
    expect(quotaMonthKey(new Date("2026-10-31T23:59:00Z"))).toBe("2026-10");
    expect(quotaMonthKey(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11");
    expect(nextQuotaReset(new Date("2026-12-15T12:00:00Z"))).toBe("2027-01-01");
  });
});
