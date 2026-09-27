import { keepsHomeFilters } from "../homeFilters";

describe("keepsHomeFilters", () => {
  it("keeps the homepage's filters on the homepage and while looking at a company from it", () => {
    expect(keepsHomeFilters("/")).toBe(true);
    expect(keepsHomeFilters("/companies/demo-finans-holding")).toBe(true);
  });

  it("forgets them on any other page", () => {
    for (const path of ["/jobs", "/social", "/messages", "/me", "/me/reviews", "/my/companies"]) {
      expect(keepsHomeFilters(path)).toBe(false);
    }
  });
});
