import { savedJobPostingToggleResultSchema, savedJobPostingSchema } from "../savedJobPosting";

describe("savedJobPosting schemas", () => {
  it("toggle result", () => {
    expect(savedJobPostingToggleResultSchema.safeParse({ jobPostingId: "x", saved: true }).success).toBe(true);
  });

  it("list item requires expired flag", () => {
    expect(
      savedJobPostingSchema.safeParse({ id: "x", companyId: "y", jobTitle: "t", description: "d" }).success,
    ).toBe(false);
    expect(
      savedJobPostingSchema.safeParse({ id: "x", companyId: "y", jobTitle: "t", description: "d", expired: false })
        .success,
    ).toBe(true);
  });
});
