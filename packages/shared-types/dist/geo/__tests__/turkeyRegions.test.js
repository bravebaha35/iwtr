"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const turkey_1 = require("../turkey");
const turkeyRegions_1 = require("../turkeyRegions");
describe("turkeyRegionKeySchema", () => {
    test("accepts exactly the 7 TURKEY_REGIONS keys, nothing more or less", () => {
        const keys = turkeyRegions_1.TURKEY_REGIONS.map((r) => r.key);
        expect(turkeyRegions_1.turkeyRegionKeySchema.options.slice().sort()).toEqual(keys.slice().sort());
        for (const key of keys) {
            expect(turkeyRegions_1.turkeyRegionKeySchema.safeParse(key).success).toBe(true);
        }
    });
});
describe("TURKEY_REGIONS province coverage", () => {
    test("every one of the 81 real provinces appears in exactly one region", () => {
        const allListed = turkeyRegions_1.TURKEY_REGIONS.flatMap((r) => r.provinces);
        expect(allListed.length).toBe(turkey_1.TURKEY_PROVINCES.length);
        expect(new Set(allListed).size).toBe(allListed.length); // no duplicates across/within regions
        const realNames = new Set(turkey_1.TURKEY_PROVINCES.map((p) => p.name));
        for (const name of allListed) {
            expect(realNames.has(name)).toBe(true); // every listed name is a real, correctly-spelled province
        }
    });
});
describe("provincesInRegion", () => {
    test("returns real TurkeyProvince rows (with districts) for Marmara, including İstanbul", () => {
        const provinces = (0, turkeyRegions_1.provincesInRegion)("MARMARA");
        const istanbul = provinces.find((p) => p.name === "İstanbul");
        expect(istanbul).toBeDefined();
        expect(istanbul.districts).toContain("Kadıköy");
    });
    test("never crosses region boundaries", () => {
        expect((0, turkeyRegions_1.provincesInRegion)("EGE").some((p) => p.name === "Ankara")).toBe(false);
    });
});
describe("findRegionByProvinceName", () => {
    test("is case- and diacritic-insensitive", () => {
        expect((0, turkeyRegions_1.findRegionByProvinceName)("istanbul")).toBe("MARMARA");
        expect((0, turkeyRegions_1.findRegionByProvinceName)("İZMİR")).toBe("EGE");
    });
    test("returns null for an unrecognized name", () => {
        expect((0, turkeyRegions_1.findRegionByProvinceName)("Not A Real Province")).toBeNull();
        expect((0, turkeyRegions_1.findRegionByProvinceName)(null)).toBeNull();
    });
});
describe("regionLabel", () => {
    test("returns the Turkish display label", () => {
        expect((0, turkeyRegions_1.regionLabel)("IC_ANADOLU")).toBe("İç Anadolu");
        expect((0, turkeyRegions_1.regionLabel)("GUNEYDOGU_ANADOLU")).toBe("Güneydoğu Anadolu");
    });
});
