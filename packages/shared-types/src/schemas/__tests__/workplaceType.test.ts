import { workplaceTypeSchema, defaultBannerUrlForWorkplaceType, primaryWorkplaceType } from "../workplaceType";

describe("workplaceType", () => {
  it("accepts the four known values and rejects anything else", () => {
    expect(workplaceTypeSchema.safeParse("OFFICE").success).toBe(true);
    expect(workplaceTypeSchema.safeParse("REMOTE").success).toBe(false);
  });

  it("maps a primary work-type to its default banner", () => {
    expect(defaultBannerUrlForWorkplaceType("MANUAL_LABOUR")).toBe("/manual-labour-default-banner.webp");
  });

  it("primaryWorkplaceType returns the first entry", () => {
    expect(primaryWorkplaceType({ workplaceTypes: ["SERVICE", "OFFICE"] })).toBe("SERVICE");
  });
});
