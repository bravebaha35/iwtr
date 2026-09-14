"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const turkey_1 = require("../turkey");
const turkeyAreaCodes_1 = require("../turkeyAreaCodes");
describe("areaCodesForProvince", () => {
    test("returns Ankara's single area code", () => {
        expect((0, turkeyAreaCodes_1.areaCodesForProvince)("Ankara")).toEqual(["312"]);
    });
    test("returns both of İstanbul's area codes", () => {
        expect((0, turkeyAreaCodes_1.areaCodesForProvince)("İstanbul")).toEqual(["212", "216"]);
    });
    test("is case- and diacritic-insensitive, like findProvinceByCityName", () => {
        expect((0, turkeyAreaCodes_1.areaCodesForProvince)("istanbul")).toEqual(["212", "216"]);
        expect((0, turkeyAreaCodes_1.areaCodesForProvince)("İZMİR")).toEqual(["232"]);
    });
    test("returns null for an unrecognized province name", () => {
        expect((0, turkeyAreaCodes_1.areaCodesForProvince)("Not A Real Province")).toBeNull();
    });
    test("returns null for a null/undefined input", () => {
        expect((0, turkeyAreaCodes_1.areaCodesForProvince)(null)).toBeNull();
        expect((0, turkeyAreaCodes_1.areaCodesForProvince)(undefined)).toBeNull();
    });
});
describe("provinceForAreaCode", () => {
    test("resolves Ankara's code back to Ankara", () => {
        expect((0, turkeyAreaCodes_1.provinceForAreaCode)("312")?.name).toBe("Ankara");
    });
    test("resolves both of İstanbul's codes back to İstanbul", () => {
        expect((0, turkeyAreaCodes_1.provinceForAreaCode)("212")?.name).toBe("İstanbul");
        expect((0, turkeyAreaCodes_1.provinceForAreaCode)("216")?.name).toBe("İstanbul");
    });
    test("returns null for a code that isn't a real area code", () => {
        expect((0, turkeyAreaCodes_1.provinceForAreaCode)("399")).toBeNull();
    });
});
describe("area code data integrity", () => {
    test("every province in TURKEY_PROVINCES has a matching area-code entry", () => {
        for (const province of turkey_1.TURKEY_PROVINCES) {
            expect(turkeyAreaCodes_1.TURKEY_AREA_CODES_BY_PLATE[province.plate]).toBeDefined();
            expect(turkeyAreaCodes_1.TURKEY_AREA_CODES_BY_PLATE[province.plate].length).toBeGreaterThan(0);
        }
    });
    test("TURKEY_AREA_CODES_BY_PLATE has no extra plates beyond the 81 real provinces", () => {
        const realPlates = new Set(turkey_1.TURKEY_PROVINCES.map((p) => p.plate));
        for (const plate of Object.keys(turkeyAreaCodes_1.TURKEY_AREA_CODES_BY_PLATE)) {
            expect(realPlates.has(plate)).toBe(true);
        }
    });
    test("every area code is exactly 3 digits", () => {
        for (const code of turkeyAreaCodes_1.ALL_TURKEY_AREA_CODES) {
            expect(code).toMatch(/^\d{3}$/);
        }
    });
    test("ALL_TURKEY_AREA_CODES has no duplicates and includes both İstanbul codes", () => {
        expect(new Set(turkeyAreaCodes_1.ALL_TURKEY_AREA_CODES).size).toBe(turkeyAreaCodes_1.ALL_TURKEY_AREA_CODES.length);
        expect(turkeyAreaCodes_1.ALL_TURKEY_AREA_CODES).toContain("212");
        expect(turkeyAreaCodes_1.ALL_TURKEY_AREA_CODES).toContain("216");
    });
});
