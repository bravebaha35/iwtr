import { buildRivalAnalyticsPdf, buildSectorBenchmarkPdf } from "../pdf-report.builder";

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

  it("draws the green/red split bar when flags of both colors are present", async () => {
    const buffer = await buildRivalAnalyticsPdf({
      targetCompanyName: "Rival Co.",
      requestingCompanyName: "My Co.",
      requesterTier: "PRO",
      generatedAt: new Date("2026-01-01T00:00:00Z"),
      overallRating: 2.5,
      reviewCount: 10,
      mostAgreed: null,
      mostDisputed: null,
      vibeFlags: [
        { category: "corporateCulture", cluster: 1, color: "GREEN", label: "Collaborative Team" },
        { category: "stability", cluster: 2, color: "RED", label: "High Turnover" },
      ],
      commentThemes: [],
    });

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

describe("buildSectorBenchmarkPdf", () => {
  const base = {
    sectorCategory: "Süpermarket",
    city: "İstanbul",
    requestingCompanyName: "Şirket A.Ş.",
    generatedAt: new Date("2026-09-24T00:00:00Z"),
    reviewCount: 40,
    companyCount: 6,
    salaryBands: [{ salaryYear: 2026, bottom25: 28000, median: 33500, top75: 41000, respondentCount: 12 }],
    benefits: [{ benefit: "MEAL_CARD" as const, label: "Meal card", percent: 60 }],
    benefitRespondentCount: 12,
    mostAgreed: [{ text: "Is pay on time?", category: "stability", agreePercent: 90, disagreePercent: 5, answerCount: 20 }],
    mostDisagreed: [{ text: "Is overtime paid?", category: "workLifeBalance", agreePercent: 10, disagreePercent: 85, answerCount: 20 }],
    turnover: {
      turnoverRiskPercentage: 50,
      spikeDetected: true,
      sampleSizeWarning: false,
      reviewsInWindow: 30,
      explanation: "50% of warning signs are red.",
    },
  };

  it("compiles a real PDF with Turkish names and the embedded brand font", async () => {
    const buffer = await buildSectorBenchmarkPdf(base);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    // The subsetted TrueType font is embedded under its PostScript name.
    expect(buffer.toString("latin1")).toMatch(/PlusJakartaSans-Regular/);
  });

  it("still compiles when every section is empty", async () => {
    const buffer = await buildSectorBenchmarkPdf({
      ...base,
      city: null,
      salaryBands: [],
      benefits: [],
      benefitRespondentCount: 0,
      mostAgreed: [],
      mostDisagreed: [],
    });
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
