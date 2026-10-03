import PDFDocument from "pdfkit";
import { FlagCalculatorService } from "../../flags/flag-calculator.service";
import { getQuestionsFor } from "../../reviews/survey-questions.data";
import {
  HrAnalyticsReportDataService,
  NOT_ENOUGH_REVIEWS,
  cleanText,
  flagExplanation,
  ownLogoPath,
  postingImpacts,
  splitPercent,
  type HrAnalyticsReportData,
} from "../hr-analytics-report.data";
import { buildHrAnalyticsPdf } from "../hr-analytics-report.pdf";

const COMPANY = "11111111-1111-4111-8111-111111111111";

// A published review answering every OFFICE question the healthy way,
// except the given question ids.
function review(unhealthy: string[] = []) {
  const answers: Record<string, string> = {};
  for (const q of getQuestionsFor("OFFICE")) {
    const flip = q.correctAnswer === "YES" ? "NO" : "YES";
    answers[q.id] = unhealthy.includes(q.id) ? flip : q.correctAnswer;
  }
  return { workplaceType: "OFFICE", surveyAnswers: answers };
}

function makePrisma(reviews: ReturnType<typeof review>[]) {
  return {
    company: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        name: "Şirket\u0000 A.Ş. 🚀",
        category: "Finance",
        city: "İstanbul",
        district: "Kadıköy",
        workplaceTypes: ["OFFICE", "SERVICE"],
        website: "javascript:alert(1)",
        contactEmail: "ik@sirket.com",
        contactPhone: null,
        mainPhotoUrl: "http://169.254.169.254/latest/meta-data/logo.png",
        riskScore: 1,
      }),
    },
    review: { findMany: jest.fn().mockResolvedValue(reviews) },
    jobPosting: {
      findMany: jest.fn().mockResolvedValue([
        { id: "p3", jobTitle: "teller", workType: "OFFICE", status: "PUBLISHED", createdAt: new Date("2026-09-01T00:00:00Z"), filledAt: null },
        { id: "p1", jobTitle: "Teller", workType: "OFFICE", status: "FILLED", createdAt: new Date("2026-05-01T00:00:00Z"), filledAt: new Date("2026-06-01T00:00:00Z") },
      ]),
    },
  } as Record<string, any>;
}

describe("HrAnalyticsReportDataService.build", () => {
  it("turns reviews into percentages only, with no counts, ids or dates", async () => {
    const reviews = [review(["OFFICE.leadership.1"]), review(), review(["OFFICE.leadership.1"])];
    const data = await new HrAnalyticsReportDataService(makePrisma(reviews) as never, new FlagCalculatorService()).build(COMPANY);

    expect(data.workTypes).toHaveLength(1);
    expect(data.skippedWorkTypes).toEqual(["Service"]);
    const leadership = data.workTypes[0].categories.find((c) => c.title === "Leadership & Management")!;
    expect(leadership.questions[0]).toMatchObject({ healthyPercent: 33, unhealthyPercent: 67, skippedPercent: 0 });
    expect(data.workTypes[0].flags.length).toBeGreaterThanOrEqual(10);

    const json = JSON.stringify(data);
    expect(json).not.toMatch(/"\w*count"|totalReviews|reviewId|userId|questionId|createdAt/i);
    expect(json).not.toContain("correctAnswer");
  });

  it("cleans owner-entered text and never reaches out for a logo", async () => {
    const data = await new HrAnalyticsReportDataService(makePrisma([review(), review(), review()]) as never, new FlagCalculatorService()).build(COMPANY);
    expect(data.company.name).toBe("Şirket A.Ş.");
    expect(data.company.logoPath).toBeNull();
    // Printed as plain text, never as a link.
    expect(data.company.website).toBe("javascript:alert(1)");
  });

  it("marks which posting raised the Risk Score", async () => {
    const data = await new HrAnalyticsReportDataService(makePrisma([review(), review(), review()]) as never, new FlagCalculatorService()).build(COMPANY);
    expect(data.risk.score).toBe(1);
    expect(data.risk.postings.map((p) => [p.postedMonth, p.outcome, p.impact])).toEqual([
      ["Sep 2026", "Open", "RAISED"],
      ["May 2026", "Filled", "NONE"],
    ]);
  });

  it("refuses to build with too few reviews", async () => {
    const service = new HrAnalyticsReportDataService(makePrisma([review(), review()]) as never, new FlagCalculatorService());
    await expect(service.build(COMPANY)).rejects.toThrow(NOT_ENOUGH_REVIEWS);
  });
});

describe("report helpers", () => {
  it("splits shares into whole numbers that add up to 100", () => {
    expect(splitPercent([1, 1, 1])).toEqual([34, 33, 33]);
    expect(splitPercent([2, 1, 0])).toEqual([67, 33, 0]);
    expect(splitPercent([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("strips control characters, emoji and runs of whitespace, and caps length", () => {
    expect(cleanText("  A\u0007B\u202Ec  \n d 😀 ")).toBe("A B c d");
    expect(cleanText("x".repeat(200), 10)).toBe(`${"x".repeat(9)}…`);
    expect(cleanText("   ")).toBeNull();
  });

  it("only accepts this API's own uploaded logos", () => {
    expect(ownLogoPath("http://169.254.169.254/uploads/company-logos/../../.env")).toBeNull();
    expect(ownLogoPath("https://evil.example/logo.png")).toBeNull();
    expect(ownLogoPath("file:///etc/passwd")).toBeNull();
    expect(ownLogoPath("not a url")).toBeNull();
  });

  it("scores postings: reopened raises, filled-and-kept is positive, the rest neutral", () => {
    const row = (id: string, jobTitle: string, status: "FILLED" | "PUBLISHED" | "PENDING_ADMIN", created: string, filled: string | null = null) => ({
      id,
      jobTitle,
      workType: "OFFICE" as const,
      status,
      createdAt: new Date(created),
      filledAt: filled ? new Date(filled) : null,
    });
    const impacts = postingImpacts([
      row("b", "Cashier", "PUBLISHED", "2026-08-01"),
      row("a", "Cashier", "FILLED", "2026-05-01", "2026-06-01"),
      row("c", "Driver", "FILLED", "2026-04-01", "2026-04-20"),
      row("d", "Driver", "PENDING_ADMIN", "2026-09-01"),
      // Posted before the earlier one was marked filled: no effect.
      row("e", "Cook", "PUBLISHED", "2026-03-05"),
      row("f", "Cook", "FILLED", "2026-03-01", "2026-03-10"),
    ]);
    expect(Object.fromEntries(impacts)).toEqual({ a: "NONE", b: "RAISED", c: "KEPT_CLEAN", d: "NONE", e: "NONE", f: "KEPT_CLEAN" });
  });

  it("explains a flag with its strongest question", () => {
    const q = (text: string, agree: number, disagree: number) => ({
      questionId: "OFFICE.leadership.1",
      category: "leadership" as const,
      text,
      agreeCount: agree,
      disagreeCount: disagree,
      preferNotCount: 0,
    });
    expect(flagExplanation("GREEN", [q("Is A fair?", 1, 1), q("Is B fair?", 3, 1)])).toBe(
      'Earned because most answers in this area were healthy, strongest on "Is B fair?" (75% healthy).',
    );
    expect(flagExplanation("RED", [q("Is A fair?", 1, 3)])).toContain('weakest on "Is A fair?" (75% unhealthy)');
  });
});

describe("buildHrAnalyticsPdf", () => {
  const data: HrAnalyticsReportData = {
    company: {
      name: "Şirket A.Ş.",
      category: "Finance",
      location: "Kadıköy, İstanbul",
      workTypes: ["Office"],
      website: null,
      email: null,
      phone: null,
      logoPath: null,
    },
    generatedAt: new Date("2026-10-03T00:00:00Z"),
    workTypes: [
      {
        label: "Office",
        flags: [],
        categories: [
          { title: "Corporate Culture", healthyPercent: 60, questions: getQuestionsFor("OFFICE").slice(0, 5).map((q) => ({ text: q.text, healthyPercent: 60, unhealthyPercent: 40, skippedPercent: 0 })) },
        ],
      },
    ],
    skippedWorkTypes: [],
    risk: { score: null, postings: [], olderPostingsNotShown: 0 },
  };
  const pages = (buffer: Buffer) => buffer.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;

  it("builds a two-page PDF in Plus Jakarta Sans with the brand mark bottom left on every page", async () => {
    const image = jest.spyOn(PDFDocument.prototype, "image");
    const buffer = await buildHrAnalyticsPdf({ ...data, workTypes: [{ ...data.workTypes[0], flags: [{ tone: "STRENGTH", label: "Collaborative Team", explanation: "Why." }] }] });
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buffer.toString("latin1")).toMatch(/PlusJakartaSans-Bold/);
    expect(pages(buffer)).toBe(2);
    const marks = image.mock.calls.filter(([src]) => String(src).endsWith("brand-mark.png"));
    expect(marks).toHaveLength(2);
    // Bottom left: the page margin on the left, below the content area.
    for (const [, x, y] of marks) {
      expect(x).toBe(36);
      expect(y as number).toBeGreaterThan(780);
    }
    image.mockRestore();
  });

  it("flows a long list of Vibe Flags onto extra pages instead of cutting them off", async () => {
    const flags = Array.from({ length: 40 }, (_, i) => ({ tone: "CONCERN" as const, label: `Flag ${i}`, explanation: "A sentence explaining why this flag was earned. ".repeat(3) }));
    const buffer = await buildHrAnalyticsPdf({ ...data, workTypes: [{ ...data.workTypes[0], flags }] });
    expect(pages(buffer)).toBeGreaterThan(3);
  });
});
