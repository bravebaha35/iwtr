/**
 * Writes a sample HR Analytics Report PDF from made-up data, for checking
 * the layout without a database or a paid plan:
 *   pnpm exec ts-node --transpile-only scripts/dev-sample-hr-report.ts [out.pdf] [flagCount]
 */
import { writeFileSync } from "node:fs";
import { buildHrAnalyticsPdf } from "../src/modules/rival-analytics/hr-analytics-report.pdf";
import type { HrAnalyticsReportData, HrReportFlag } from "../src/modules/rival-analytics/hr-analytics-report.data";
import { CATEGORY_TITLES } from "../src/modules/rival-analytics/hr-analytics-report.data";
import { getQuestionsFor } from "../src/modules/reviews/survey-questions.data";

const out = process.argv[2] ?? "sample-hr-report.pdf";
const flagCount = Number(process.argv[3] ?? 10);

const tones: HrReportFlag["tone"][] = ["STRENGTH", "CONCERN", "MIXED"];
const flags: HrReportFlag[] = Array.from({ length: flagCount }, (_, i) => ({
  tone: tones[i % 3],
  label: ["Collaborative Team", "Extreme Micromanagement", "Praised but Underpaid", "Modern Equipment", "Unpaid Overtime Expected"][i % 5],
  explanation:
    i % 3 === 2
      ? "Most reviewers say managers praise their work, yet the same reviewers say pay hasn't kept up with their responsibilities."
      : `Earned because most answers in this area were ${i % 3 === 0 ? "healthy, strongest on" : "unhealthy, weakest on"} "Can employees openly criticize company decisions in meetings without fear of retaliation?" (${60 + i}% ${i % 3 === 0 ? "healthy" : "unhealthy"}).`,
}));

const questions = getQuestionsFor("OFFICE");
const data: HrAnalyticsReportData = {
  company: {
    name: "Demo Finans Holding A.Ş.",
    category: "Finance",
    location: "Kadıköy, İstanbul",
    workTypes: ["Office", "Service"],
    website: "https://demofinans.com.tr",
    email: "ik@demofinans.com.tr",
    phone: "+90 216 555 01 01",
    logoPath: null,
  },
  generatedAt: new Date(),
  workTypes: [
    {
      label: "Office",
      flags,
      categories: (Object.keys(CATEGORY_TITLES) as (keyof typeof CATEGORY_TITLES)[]).map((key, ci) => ({
        title: CATEGORY_TITLES[key],
        healthyPercent: 48 + ci * 7,
        questions: questions
          .filter((q) => q.category === key)
          .map((q, qi) => {
            const healthy = (37 + ci * 11 + qi * 13) % 101;
            const skipped = qi % 3 === 0 ? 7 : 0;
            return { text: q.text, healthyPercent: healthy, unhealthyPercent: Math.max(0, 100 - healthy - skipped), skippedPercent: Math.min(skipped, 100 - healthy) };
          }),
      })),
    },
  ],
  skippedWorkTypes: ["Service"],
  risk: {
    score: 1,
    postings: [
      { jobTitle: "Senior Credit Risk Analyst", workType: "Office", postedMonth: "Sep 2026", outcome: "Open", impact: "NONE" },
      { jobTitle: "Customer Relations Specialist", workType: "Office", postedMonth: "Aug 2026", outcome: "Open", impact: "RAISED" },
      { jobTitle: "Customer Relations Specialist", workType: "Office", postedMonth: "May 2026", outcome: "Filled", impact: "NONE" },
      { jobTitle: "Branch Operations Officer", workType: "Service", postedMonth: "Mar 2026", outcome: "Filled", impact: "KEPT_CLEAN" },
    ],
    olderPostingsNotShown: 3,
  },
};

void buildHrAnalyticsPdf(data).then((pdf) => {
  writeFileSync(out, pdf);
  console.log(`wrote ${out} (${pdf.length} bytes)`);
});
