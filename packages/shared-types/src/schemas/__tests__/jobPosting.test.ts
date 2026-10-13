import {
  jobPostingStatusSchema,
  createJobPostingInputSchema,
  updateJobPostingInputSchema,
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
      positions: ["SERVICE_STAFF"],
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
      positions: ["SERVICE_STAFF"],
      boost: null,
    });
    expect(parsed.jobTitle).toBe("Cashier");
  });

  it("createJobPostingInputSchema takes 1 to 3 different positions and a description up to 4000 characters", () => {
    const base = { jobTitle: "Cashier", description: "d", workType: "SERVICE", boost: null };
    const ok = (positions: string[]) => createJobPostingInputSchema.safeParse({ ...base, positions }).success;
    expect(ok(["INTERN"])).toBe(true);
    expect(ok(["INTERN", "SPECIALIST", "FREELANCER"])).toBe(true);
    expect(ok([])).toBe(false);
    expect(ok(["INTERN", "SPECIALIST", "FREELANCER", "STAFF_MEMBER"])).toBe(false);
    expect(ok(["INTERN", "INTERN"])).toBe(false);
    expect(ok(["CEO"])).toBe(false);
    const withText = (n: number) =>
      createJobPostingInputSchema.safeParse({ ...base, positions: ["INTERN"], description: "x".repeat(n) }).success;
    expect(withText(4000)).toBe(true);
    expect(withText(4001)).toBe(false);
  });

  it("updateJobPostingInputSchema takes new positions on their own, under the same 1 to 3 rule", () => {
    const ok = (body: unknown) => updateJobPostingInputSchema.safeParse(body).success;
    expect(ok({ positions: ["INTERN", "SPECIALIST"] })).toBe(true);
    expect(ok({ positions: [] })).toBe(false);
    expect(ok({ positions: ["INTERN", "SPECIALIST", "FREELANCER", "STAFF_MEMBER"] })).toBe(false);
    expect(ok({})).toBe(false);
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
