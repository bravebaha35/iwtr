"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const workplaceType_1 = require("../workplaceType");
describe("workplaceType", () => {
    it("accepts the four known values and rejects anything else", () => {
        expect(workplaceType_1.workplaceTypeSchema.safeParse("OFFICE").success).toBe(true);
        expect(workplaceType_1.workplaceTypeSchema.safeParse("REMOTE").success).toBe(false);
    });
    it("maps a primary work-type to its default banner", () => {
        expect((0, workplaceType_1.defaultBannerUrlForWorkplaceType)("MANUAL_LABOUR")).toBe("/manual-labour-default-banner.webp");
    });
    it("primaryWorkplaceType returns the first entry", () => {
        expect((0, workplaceType_1.primaryWorkplaceType)({ workplaceTypes: ["SERVICE", "OFFICE"] })).toBe("SERVICE");
    });
});
