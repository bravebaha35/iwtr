"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const savedJobPosting_1 = require("../savedJobPosting");
describe("savedJobPosting schemas", () => {
    it("toggle result", () => {
        expect(savedJobPosting_1.savedJobPostingToggleResultSchema.safeParse({ jobPostingId: "x", saved: true }).success).toBe(true);
    });
    it("list item requires expired flag", () => {
        expect(savedJobPosting_1.savedJobPostingSchema.safeParse({ id: "x", companyId: "y", jobTitle: "t", description: "d" }).success).toBe(false);
        expect(savedJobPosting_1.savedJobPostingSchema.safeParse({ id: "x", companyId: "y", jobTitle: "t", description: "d", expired: false })
            .success).toBe(true);
    });
});
