import { buildRivalAnalyticsPdf } from "../pdf-report.builder";

describe("buildRivalAnalyticsPdf", () => {
  it("produces a real PDF file (starts with the %PDF- signature)", async () => {
    const buffer = await buildRivalAnalyticsPdf({
      targetCompanyName: "Rival Co.",
      requestingCompanyName: "My Co.",
      requesterTier: "ENTERPRISE",
      generatedAt: new Date("2026-01-01T00:00:00Z"),
      overallRating: 3.7,
      reviewCount: 42,
      mostAgreed: { text: "Is the team collaborative?", category: "corporateCulture" },
      mostDisputed: { text: "Is overtime paid?", category: "workLifeBalance" },
      vibeFlags: [{ category: "corporateCulture", cluster: 1, color: "GREEN", label: "Collaborative Team" }],
      commentThemes: [{ theme: "Culture", mentionCount: 5 }],
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(100);
  });

  it("does not throw when there are no reviews at all yet", async () => {
    const buffer = await buildRivalAnalyticsPdf({
      targetCompanyName: "Brand New Co.",
      requestingCompanyName: "My Co.",
      requesterTier: null,
      generatedAt: new Date("2026-01-01T00:00:00Z"),
      overallRating: null,
      reviewCount: 0,
      mostAgreed: null,
      mostDisputed: null,
      vibeFlags: [],
      commentThemes: [],
    });

    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
