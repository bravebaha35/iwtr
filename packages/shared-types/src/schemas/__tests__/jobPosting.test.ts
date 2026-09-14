import {
  jobPostingStatusSchema,
  createJobPostingInputSchema,
  publicJobPostingSchema,
  ownerJobPostingSchema,
} from "../jobPosting";

describe("jobPosting schemas", () => {
  it("jobPostingStatusSchema accepts FILLED", () => {
    expect(jobPostingStatusSchema.safeParse("FILLED").success).toBe(true);
  });

  it("createJobPostingInputSchema requires workType and defaults autoReshareEnabled to false", () => {
    const parsed = createJobPostingInputSchema.parse({
      jobTitle: "Cashier",
      description: "Front register",
      workType: "SERVICE",
      boost: null,
    });
    expect(parsed.autoReshareEnabled).toBe(false);
    expect(createJobPostingInputSchema.safeParse({ jobTitle: "x", description: "y", boost: null }).success).toBe(
      false,
    );
  });

  it("createJobPostingInputSchema trims jobTitle", () => {
    const parsed = createJobPostingInputSchema.parse({
      jobTitle: "  Cashier  ",
      description: "d",
      workType: "SERVICE",
      boost: null,
    });
    expect(parsed.jobTitle).toBe("Cashier");
  });

  it("publicJobPostingSchema requires an id", () => {
    expect(publicJobPostingSchema.safeParse({ jobTitle: "x", description: "y" }).success).toBe(false);
    expect(
      publicJobPostingSchema.safeParse({ id: "11111111-1111-1111-1111-111111111111", jobTitle: "x", description: "y" })
        .success,
    ).toBe(true);
  });

  it("ownerJobPostingSchema carries daysRemaining", () => {
    const base = {
      id: "11111111-1111-1111-1111-111111111111",
      companyId: "22222222-2222-2222-2222-222222222222",
      jobTitle: "x",
      description: "y",
      status: "PUBLISHED",
      workType: "SERVICE",
      boostDurationDays: null,
      boostExpiresAt: null,
      createdAt: new Date().toISOString(),
      daysRemaining: 17,
    };
    expect(ownerJobPostingSchema.safeParse(base).success).toBe(true);
  });
});
