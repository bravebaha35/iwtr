"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jobPosting_1 = require("../jobPosting");
describe("jobPosting schemas", () => {
    it("jobPostingStatusSchema accepts FILLED", () => {
        expect(jobPosting_1.jobPostingStatusSchema.safeParse("FILLED").success).toBe(true);
    });
    it("createJobPostingInputSchema requires workType and defaults autoReshareEnabled to false", () => {
        const parsed = jobPosting_1.createJobPostingInputSchema.parse({
            jobTitle: "Cashier",
            description: "Front register",
            workType: "SERVICE",
            boost: null,
        });
        expect(parsed.autoReshareEnabled).toBe(false);
        expect(jobPosting_1.createJobPostingInputSchema.safeParse({ jobTitle: "x", description: "y", boost: null }).success).toBe(false);
    });
    it("createJobPostingInputSchema trims jobTitle", () => {
        const parsed = jobPosting_1.createJobPostingInputSchema.parse({
            jobTitle: "  Cashier  ",
            description: "d",
            workType: "SERVICE",
            boost: null,
        });
        expect(parsed.jobTitle).toBe("Cashier");
    });
    it("publicJobPostingSchema requires an id", () => {
        expect(jobPosting_1.publicJobPostingSchema.safeParse({ jobTitle: "x", description: "y" }).success).toBe(false);
        expect(jobPosting_1.publicJobPostingSchema.safeParse({ id: "11111111-1111-1111-1111-111111111111", jobTitle: "x", description: "y" })
            .success).toBe(true);
    });
    it("ownerJobPostingSchema carries daysRemaining", () => {
        const base = {
            id: "11111111-1111-1111-1111-111111111111",
            companyId: "22222222-2222-2222-2222-222222222222",
            jobTitle: "x",
            description: "y",
            status: "PUBLISHED",
            workType: "SERVICE",
            boostDurationDays: null,
            boostExpiresAt: null,
            createdAt: new Date().toISOString(),
            daysRemaining: 17,
        };
        expect(jobPosting_1.ownerJobPostingSchema.safeParse(base).success).toBe(true);
    });
});
