import { TURKEY_PROVINCES } from "@iwtr/shared-types";
import { MockBranchPresenceProvider } from "../branch-presence.provider";

describe("MockBranchPresenceProvider", () => {
  const provider = new MockBranchPresenceProvider();

  it("does not place Starbucks in all 81 provinces (the task's own example)", () => {
    const presence = provider.getCityPresence("Starbucks");
    expect(presence.length).toBeGreaterThan(0);
    expect(presence.length).toBeLessThan(TURKEY_PROVINCES.length);
    expect(presence).toContain("İstanbul");
    expect(presence).not.toContain("Hakkari");
  });

  it("gives ubiquitous discount chains full nationwide coverage", () => {
    expect(provider.getCityPresence("A101").length).toBe(TURKEY_PROVINCES.length);
    expect(provider.getCityPresence("BİM").length).toBe(TURKEY_PROVINCES.length);
  });

  it("returns an empty list for an unknown brand rather than throwing", () => {
    expect(provider.getCityPresence("Not A Real Brand")).toEqual([]);
    expect(provider.getRegionPresence("Not A Real Brand")).toEqual([]);
  });

  it("region-based brands never claim more than the real 7 regions and Petrol Ofisi covers all of them", () => {
    const ALL_REGION_KEYS = ["MARMARA", "EGE", "AKDENIZ", "IC_ANADOLU", "KARADENIZ", "DOGU_ANADOLU", "GUNEYDOGU_ANADOLU"];
    const opRegions = provider.getRegionPresence("Petrol Ofisi");
    expect(opRegions.length).toBe(7);
    for (const r of opRegions) expect(ALL_REGION_KEYS).toContain(r);
  });

  it("every province name returned is a real, correctly-spelled TURKEY_PROVINCES entry", () => {
    const realNames = new Set(TURKEY_PROVINCES.map((p) => p.name));
    for (const brand of ["Starbucks", "Burger King", "Turkcell Superonline", "LC Waikiki"]) {
      for (const city of provider.getCityPresence(brand)) {
        expect(realNames.has(city)).toBe(true);
      }
    }
  });
});
