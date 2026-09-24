import { createReviewInputSchema, compensationInputSchema } from "@iwtr/shared-types";

describe("compensationInputSchema (KVKK consent gate)", () => {
  it("drops salary and benefits entirely when consent is not given", () => {
    expect(
      compensationInputSchema.parse({
        hasConsentedToCommercialBenchmarking: false,
        monthlyNetSalary: "₺45.000",
        benefits: ["MEAL_CARD"],
      }),
    ).toBeNull();
  });

  it("drops even an unparseable salary without an error when consent is not given", () => {
    expect(
      compensationInputSchema.safeParse({ hasConsentedToCommercialBenchmarking: false, monthlyNetSalary: "lots" }).success,
    ).toBe(true);
  });

  it.each([
    ["₺45.000", 45000],
    ["45000", 45000],
    ["45.000,50 TL", 45000],
    ["45000.5", 45000],
    [" 1.250.000 ₺ ", 1250000],
  ])("strips currency symbols and separators: %s -> %d", (raw, expected) => {
    expect(
      compensationInputSchema.parse({ hasConsentedToCommercialBenchmarking: true, monthlyNetSalary: raw }),
    ).toEqual({ monthlyNetSalary: expected, benefits: [] });
  });

  it.each(["abc", "₺500", "999999999"])("rejects a salary that isn't a plausible number: %s", (raw) => {
    expect(
      compensationInputSchema.safeParse({ hasConsentedToCommercialBenchmarking: true, monthlyNetSalary: raw }).success,
    ).toBe(false);
  });

  it("keeps benefits on their own (no salary) and de-duplicates them", () => {
    expect(
      compensationInputSchema.parse({
        hasConsentedToCommercialBenchmarking: true,
        benefits: ["MEAL_CARD", "MEAL_CARD", "GYM"],
      }),
    ).toEqual({ monthlyNetSalary: null, benefits: ["MEAL_CARD", "GYM"] });
  });

  it("rejects a benefit that isn't in the fixed list", () => {
    expect(
      compensationInputSchema.safeParse({ hasConsentedToCommercialBenchmarking: true, benefits: ["FREE_CAR_WASH"] })
        .success,
    ).toBe(false);
  });

  it("returns null when consent is given but both fields are empty", () => {
    expect(compensationInputSchema.parse({ hasConsentedToCommercialBenchmarking: true, monthlyNetSalary: "" })).toBeNull();
  });

  it("requires the consent flag itself whenever the block is sent", () => {
    expect(compensationInputSchema.safeParse({ monthlyNetSalary: "45000" }).success).toBe(false);
  });

  it("is carried through createReviewInputSchema as the parsed (post-gate) value", () => {
    const parsed = createReviewInputSchema.parse({
      companyId: "7a0c1e1e-0000-4000-8000-000000000001",
      employmentHistoryId: "7a0c1e1e-0000-4000-8000-000000000002",
      workplaceType: "OFFICE",
      answers: Array.from({ length: 25 }, (_, i) => ({ questionId: `q${i}`, answer: "YES" })),
      compensation: { hasConsentedToCommercialBenchmarking: false, monthlyNetSalary: "45000" },
    });
    expect(parsed.compensation).toBeNull();
  });
});
