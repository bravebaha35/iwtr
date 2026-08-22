import { TURKEY_PROVINCES } from "../turkey";
import { TURKEY_AREA_CODES_BY_PLATE, ALL_TURKEY_AREA_CODES, areaCodesForProvince } from "../turkeyAreaCodes";

describe("areaCodesForProvince", () => {
  test("returns Ankara's single area code", () => {
    expect(areaCodesForProvince("Ankara")).toEqual(["312"]);
  });

  test("returns both of İstanbul's area codes", () => {
    expect(areaCodesForProvince("İstanbul")).toEqual(["212", "216"]);
  });

  test("is case- and diacritic-insensitive, like findProvinceByCityName", () => {
    expect(areaCodesForProvince("istanbul")).toEqual(["212", "216"]);
    expect(areaCodesForProvince("İZMİR")).toEqual(["232"]);
  });

  test("returns null for an unrecognized province name", () => {
    expect(areaCodesForProvince("Not A Real Province")).toBeNull();
  });

  test("returns null for a null/undefined input", () => {
    expect(areaCodesForProvince(null)).toBeNull();
    expect(areaCodesForProvince(undefined)).toBeNull();
  });
});

describe("area code data integrity", () => {
  test("every province in TURKEY_PROVINCES has a matching area-code entry", () => {
    for (const province of TURKEY_PROVINCES) {
      expect(TURKEY_AREA_CODES_BY_PLATE[province.plate]).toBeDefined();
      expect(TURKEY_AREA_CODES_BY_PLATE[province.plate].length).toBeGreaterThan(0);
    }
  });

  test("TURKEY_AREA_CODES_BY_PLATE has no extra plates beyond the 81 real provinces", () => {
    const realPlates = new Set(TURKEY_PROVINCES.map((p) => p.plate));
    for (const plate of Object.keys(TURKEY_AREA_CODES_BY_PLATE)) {
      expect(realPlates.has(plate)).toBe(true);
    }
  });

  test("every area code is exactly 3 digits", () => {
    for (const code of ALL_TURKEY_AREA_CODES) {
      expect(code).toMatch(/^\d{3}$/);
    }
  });

  test("ALL_TURKEY_AREA_CODES has no duplicates and includes both İstanbul codes", () => {
    expect(new Set(ALL_TURKEY_AREA_CODES).size).toBe(ALL_TURKEY_AREA_CODES.length);
    expect(ALL_TURKEY_AREA_CODES).toContain("212");
    expect(ALL_TURKEY_AREA_CODES).toContain("216");
  });
});
