import { decideRivalAnalyticsAccess } from "../access-decision.util";

describe("decideRivalAnalyticsAccess", () => {
  it("lets an Enterprise member through for free the first time", () => {
    const decision = decideRivalAnalyticsAccess({ rivalAnalyticsTier: "ENTERPRISE", rivalAnalyticsFreeRequestUsed: false });

    expect(decision).toEqual({ allowed: true, usedFreeCredit: true });
  });

  it("requires payment from an Enterprise member who already used their one free pull", () => {
    const decision = decideRivalAnalyticsAccess({ rivalAnalyticsTier: "ENTERPRISE", rivalAnalyticsFreeRequestUsed: true });

    expect(decision).toEqual({ allowed: false, reason: "PAYMENT_REQUIRED" });
  });

  it("always requires payment from a Starter member, even on their first request", () => {
    const decision = decideRivalAnalyticsAccess({ rivalAnalyticsTier: "STARTER", rivalAnalyticsFreeRequestUsed: false });

    expect(decision).toEqual({ allowed: false, reason: "PAYMENT_REQUIRED" });
  });

  it("always requires payment from a Pro member, even on their first request", () => {
    const decision = decideRivalAnalyticsAccess({ rivalAnalyticsTier: "PRO", rivalAnalyticsFreeRequestUsed: false });

    expect(decision).toEqual({ allowed: false, reason: "PAYMENT_REQUIRED" });
  });

  it("requires payment from an owner with no Rival Analytics tier at all", () => {
    const decision = decideRivalAnalyticsAccess({ rivalAnalyticsTier: null, rivalAnalyticsFreeRequestUsed: false });

    expect(decision).toEqual({ allowed: false, reason: "PAYMENT_REQUIRED" });
  });
});
