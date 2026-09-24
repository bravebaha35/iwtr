import { ForbiddenException } from "@nestjs/common";
import { FlagCalculatorService } from "../../flags/flag-calculator.service";
import { getQuestionsFor } from "../../reviews/survey-questions.data";
import { TurnoverPredictionService } from "../../turnover-risk/turnover-prediction.service";
import { SectorBenchmarkService } from "../sector-benchmark.service";
import { assertKAnonymity, INSUFFICIENT_DATA_MESSAGE } from "../sector-benchmark.util";

const SCOPE = { sectorCategory: "Supermarket", city: null };

// $queryRaw is called twice per report, in this order: scope counts, then
// salary percentiles. Each mock row is exactly what Postgres would return.
function makePrisma(opts: {
  counts: { distinctUsers: number; distinctCompanies: number; reviewCount: number };
  salaryRows?: unknown[];
  benefitRows?: unknown[];
  reviews?: unknown[];
}) {
  return {
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce([opts.counts])
      .mockResolvedValueOnce(opts.salaryRows ?? []),
    salarySubmission: { findMany: jest.fn().mockResolvedValue(opts.benefitRows ?? []) },
    review: { findMany: jest.fn().mockResolvedValue(opts.reviews ?? []) },
  };
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
  return new SectorBenchmarkService(
    prisma as never,
    new TurnoverPredictionService({} as never, new FlagCalculatorService()),
  );
}

describe("K-anonymity hard lock", () => {
  it("rejects 4 users from 2 companies", () => {
    expect(() => assertKAnonymity({ distinctUsers: 4, distinctCompanies: 2 })).toThrow(
      new ForbiddenException(INSUFFICIENT_DATA_MESSAGE),
    );
  });

  it("rejects when either floor alone is missed", () => {
    expect(() => assertKAnonymity({ distinctUsers: 50, distinctCompanies: 2 })).toThrow(ForbiddenException);
    expect(() => assertKAnonymity({ distinctUsers: 4, distinctCompanies: 30 })).toThrow(ForbiddenException);
    expect(() => assertKAnonymity({ distinctUsers: 5, distinctCompanies: 3 })).not.toThrow();
  });

  it("refuses to build a report for a sector with 4 users from 2 companies (403, before any salary query)", async () => {
    const prisma = makePrisma({ counts: { distinctUsers: 4, distinctCompanies: 2, reviewCount: 4 } });
    const error = await makeService(prisma).buildReportData(SCOPE, "My Co").catch((e) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.getStatus()).toBe(403);
    expect(error.message).toBe("Insufficient Data to Ensure Anonymity");
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.salarySubmission.findMany).not.toHaveBeenCalled();
  });
});

describe("Salary output is range bands only", () => {
  const eligible = { distinctUsers: 12, distinctCompanies: 4, reviewCount: 14 };

  it("never exposes an average, only rounded bottom25/median/top75 bands per year", async () => {
    const prisma = makePrisma({
      counts: eligible,
      salaryRows: [
        { salaryYear: 2026, distinctUsers: 9, distinctCompanies: 4, p25: 31234.5, p50: 40180, p75: 52999.75 },
        { salaryYear: 2025, distinctUsers: 6, distinctCompanies: 3, p25: 28000, p50: 33333.3, p75: 41249 },
      ],
    });
    const report = await makeService(prisma).buildReportData(SCOPE, "My Co");

    expect(report.salaryBands).toEqual([
      { salaryYear: 2026, bottom25: 31000, median: 40000, top75: 53000, respondentCount: 9 },
      { salaryYear: 2025, bottom25: 28000, median: 33500, top75: 41000, respondentCount: 6 },
    ]);
    for (const band of report.salaryBands) {
      expect(Object.keys(band).sort()).toEqual(["bottom25", "median", "respondentCount", "salaryYear", "top75"]);
    }
    expect(JSON.stringify(report)).not.toMatch(/avg|average|mean/i);
  });

  it("drops a salary year whose own respondents miss the floor (4 users)", async () => {
    const prisma = makePrisma({
      counts: eligible,
      salaryRows: [
        { salaryYear: 2026, distinctUsers: 4, distinctCompanies: 3, p25: 1, p50: 2, p75: 3 },
        { salaryYear: 2025, distinctUsers: 5, distinctCompanies: 3, p25: 30000, p50: 35000, p75: 40000 },
      ],
    });
    const report = await makeService(prisma).buildReportData(SCOPE, "My Co");
    expect(report.salaryBands.map((b) => b.salaryYear)).toEqual([2025]);
  });

  it("the salary SQL uses percentile_cont, is partitioned by salaryYear, and has no AVG()", async () => {
    const prisma = makePrisma({ counts: eligible });
    await makeService(prisma).buildReportData(SCOPE, "My Co");
    const salarySql = (prisma.$queryRaw.mock.calls[1][0] as TemplateStringsArray).join("?");
    expect(salarySql).toContain("percentile_cont(0.25)");
    expect(salarySql).toContain('GROUP BY s."salaryYear"');
    expect(salarySql).not.toMatch(/avg\s*\(/i);
  });
});

describe("Benefits and survey highlights", () => {
  const eligible = { distinctUsers: 6, distinctCompanies: 3, reviewCount: 6 };

  it("reports benefit percentages only when benefit respondents clear the floor", async () => {
    const rows = [
      { userId: "u1", companyId: "c1", benefits: ["MEAL_CARD", "BONUS"] },
      { userId: "u2", companyId: "c1", benefits: ["MEAL_CARD"] },
      { userId: "u3", companyId: "c2", benefits: [] },
      { userId: "u4", companyId: "c2", benefits: ["MEAL_CARD"] },
      { userId: "u5", companyId: "c3", benefits: [] },
    ];
    const report = await makeService(makePrisma({ counts: eligible, benefitRows: rows })).buildReportData(SCOPE, "My Co");
    expect(report.benefitRespondentCount).toBe(5);
    expect(report.benefits[0]).toEqual({ benefit: "MEAL_CARD", label: "Meal card", percent: 60 });
    expect(report.benefits.find((b) => b.benefit === "BONUS")?.percent).toBe(20);

    const thin = await makeService(makePrisma({ counts: eligible, benefitRows: rows.slice(0, 4) })).buildReportData(
      SCOPE,
      "My Co",
    );
    expect(thin.benefits).toEqual([]);
  });

  it("lists up to 10 most agreed / disagreed questions as percentages", async () => {
    const questions = getQuestionsFor("OFFICE");
    const reviews = Array.from({ length: 6 }, () => ({
      workplaceType: "OFFICE",
      publishedAt: new Date(),
      // First question always healthy, second always not, rest healthy.
      surveyAnswers: Object.fromEntries(
        questions.map((q, i) => [q.id, i === 1 ? (q.correctAnswer === "YES" ? "NO" : "YES") : q.correctAnswer]),
      ),
    }));
    const report = await makeService(makePrisma({ counts: eligible, reviews })).buildReportData(SCOPE, "My Co");
    expect(report.mostAgreed).toHaveLength(10);
    expect(report.mostAgreed[0].agreePercent).toBe(100);
    expect(report.mostDisagreed[0]).toEqual(
      expect.objectContaining({ text: questions[1].text, disagreePercent: 100, answerCount: 6 }),
    );
    expect(report.turnover.explanation.length).toBeGreaterThan(0);
  });
});
