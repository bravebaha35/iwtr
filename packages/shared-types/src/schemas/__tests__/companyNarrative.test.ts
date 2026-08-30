import { companyNarrativeSchema } from "../company";

describe("companyNarrativeSchema", () => {
  it("accepts a generated description", () => {
    const parsed = companyNarrativeSchema.parse({
      workplaceType: "OFFICE",
      reviewCount: 12,
      description: "Across 12 reviews this workplace is steady but slow to fix known problems.",
    });
    expect(parsed.description).toContain("steady");
  });

  it("accepts a null description (under 3 reviews / feature off)", () => {
    const parsed = companyNarrativeSchema.parse({ workplaceType: "SERVICE", reviewCount: 2, description: null });
    expect(parsed.description).toBeNull();
  });

  it("rejects a description over 600 characters", () => {
    expect(() =>
      companyNarrativeSchema.parse({ workplaceType: "OFFICE", reviewCount: 5, description: "x".repeat(601) }),
    ).toThrow();
  });

  it("rejects a negative review count", () => {
    expect(() =>
      companyNarrativeSchema.parse({ workplaceType: "OFFICE", reviewCount: -1, description: null }),
    ).toThrow();
  });
});
