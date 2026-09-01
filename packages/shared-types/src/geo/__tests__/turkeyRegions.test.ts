import { TURKEY_PROVINCES } from "../turkey";
import { TURKEY_REGIONS, provincesInRegion, findRegionByProvinceName, regionLabel, turkeyRegionKeySchema } from "../turkeyRegions";

describe("turkeyRegionKeySchema", () => {
  test("accepts exactly the 7 TURKEY_REGIONS keys, nothing more or less", () => {
    const keys = TURKEY_REGIONS.map((r) => r.key);
    expect(turkeyRegionKeySchema.options.slice().sort()).toEqual(keys.slice().sort());
    for (const key of keys) {
      expect(turkeyRegionKeySchema.safeParse(key).success).toBe(true);
    }
  });
});

describe("TURKEY_REGIONS province coverage", () => {
  test("every one of the 81 real provinces appears in exactly one region", () => {
    const allListed = TURKEY_REGIONS.flatMap((r) => r.provinces);
    expect(allListed.length).toBe(TURKEY_PROVINCES.length);
    expect(new Set(allListed).size).toBe(allListed.length); // no duplicates across/within regions

    const realNames = new Set(TURKEY_PROVINCES.map((p) => p.name));
    for (const name of allListed) {
      expect(realNames.has(name)).toBe(true); // every listed name is a real, correctly-spelled province
    }
  });
});

describe("provincesInRegion", () => {
  test("returns real TurkeyProvince rows (with districts) for Marmara, including İstanbul", () => {
    const provinces = provincesInRegion("MARMARA");
    const istanbul = provinces.find((p) => p.name === "İstanbul");
    expect(istanbul).toBeDefined();
    expect(istanbul!.districts).toContain("Kadıköy");
  });

  test("never crosses region boundaries", () => {
    expect(provincesInRegion("EGE").some((p) => p.name === "Ankara")).toBe(false);
  });
});

describe("findRegionByProvinceName", () => {
  test("is case- and diacritic-insensitive", () => {
    expect(findRegionByProvinceName("istanbul")).toBe("MARMARA");
    expect(findRegionByProvinceName("İZMİR")).toBe("EGE");
  });

  test("returns null for an unrecognized name", () => {
    expect(findRegionByProvinceName("Not A Real Province")).toBeNull();
    expect(findRegionByProvinceName(null)).toBeNull();
  });
});

describe("regionLabel", () => {
  test("returns the Turkish display label", () => {
    expect(regionLabel("IC_ANADOLU")).toBe("İç Anadolu");
    expect(regionLabel("GUNEYDOGU_ANADOLU")).toBe("Güneydoğu Anadolu");
  });
});
