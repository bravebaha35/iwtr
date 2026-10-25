import type { CategoryKey, SurveyQuestionStats, WorkplaceType } from "@iwtr/shared-types";
import { getQuestionsFor } from "../../reviews/survey-questions.data";
import { MAX_SUMMARY_CHARS, composeSummary, scoreBandFor } from "../summary-composer";
import { ADVICE, CATEGORY_NAMES, OPENINGS, QUESTION_PHRASES, TIP_LEAD } from "../summary-phrases.data";

const TYPES: WorkplaceType[] = ["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"];

// Every question answered by `n` reviewers, `healthy(i)` of them healthily.
function stats(type: WorkplaceType, healthy: (index: number) => number, n = 10): SurveyQuestionStats[] {
  return getQuestionsFor(type).map((q, i) => ({
    questionId: q.id,
    category: q.category,
    text: q.text,
    agreeCount: healthy(i),
    disagreeCount: n - healthy(i),
    preferNotCount: 0,
  }));
}

const flat = (v: number): Record<CategoryKey, number> => ({
  corporateCulture: v,
  leadership: v,
  infrastructure: v,
  workLifeBalance: v,
  stability: v,
});

describe("summary phrases", () => {
  it("cover every survey question of every work type, in both languages", () => {
    for (const type of TYPES) {
      for (const q of getQuestionsFor(type)) {
        const p = QUESTION_PHRASES[q.id];
        expect(p).toBeDefined();
        for (const side of [p.good, p.bad]) {
          expect(side.en.length).toBeGreaterThan(5);
          expect(side.tr.length).toBeGreaterThan(5);
        }
      }
    }
  });

  it("never state a legal verdict or name a crime (they report what reviewers say)", () => {
    const all = [
      ...Object.values(QUESTION_PHRASES).flatMap((p) => [p.good.en, p.good.tr, p.bad.en, p.bad.tr]),
      ...TYPES.flatMap((t) => Object.values(OPENINGS[t]).flatMap((o) => [o.en, o.tr])),
      ...Object.values(ADVICE).flatMap((a) => [a.tip.en, a.tip.tr, a.warn.en, a.warn.tr]),
      ...Object.values(CATEGORY_NAMES).flatMap((c) => [c.en, c.tr]),
      ...Object.values(TIP_LEAD).flatMap((c) => [c.en, c.tr]),
    ]
      .join(" ")
      .toLowerCase();
    for (const word of ["illegal", "unlawful", "crime", "fraud", "theft", "steal", "yasa dışı", "yasadışı", "kanunsuz", " suç", "dolandır", "hırsız"]) {
      expect(all).not.toContain(word);
    }
  });
});

describe("scoreBandFor", () => {
  it("bands the overall average by whole points, 4.0 and up together", () => {
    expect(scoreBandFor(1.4)).toBe(1);
    expect(scoreBandFor(2)).toBe(2);
    expect(scoreBandFor(3.99)).toBe(3);
    expect(scoreBandFor(4)).toBe(4);
    expect(scoreBandFor(5)).toBe(4);
  });
});

describe("composeSummary", () => {
  it("stays within 600 characters in both languages for every work type, band and answer pattern", () => {
    const patterns = [() => 10, () => 0, (i: number) => (i % 2 ? 9 : 1), (i: number) => (i % 3 === 0 ? 2 : 8), () => 5];
    for (const type of TYPES) {
      for (const band of [1, 2, 3, 4] as const) {
        for (const healthy of patterns) {
          const s = composeSummary({ workplaceType: type, band, questions: stats(type, healthy), categoryAverages: { ...flat(3), stability: 1.5 } });
          expect(s.en.length).toBeLessThanOrEqual(MAX_SUMMARY_CHARS);
          expect(s.tr.length).toBeLessThanOrEqual(MAX_SUMMARY_CHARS);
          expect(s.en.length).toBeGreaterThan(150);
          expect(s.tr.length).toBeGreaterThan(150);
          expect(s.en.endsWith("…")).toBe(false);
          expect(s.tr.endsWith("…")).toBe(false);
        }
      }
    }
  });

  it("names what reviewers praise and complain about, the weakest area and advice for it", () => {
    // OFFICE: unpaid overtime reported by 9 of 10 (workLifeBalance.2 is index 16), everything else healthy.
    const questions = stats("OFFICE", (i) => (i === 16 ? 1 : 9));
    const s = composeSummary({
      workplaceType: "OFFICE",
      band: 3,
      questions,
      categoryAverages: { ...flat(4), workLifeBalance: 2.6 },
    });
    expect(s.en).toContain("The most common complaint is unpaid overtime.");
    expect(s.tr).toContain("En sık dile getirilen sorun ise ücretsiz fazla mesai.");
    expect(s.en).toContain("Most praise goes to");
    expect(s.en).toContain("work-life balance its weakest");
    expect(s.en).toMatch(/Worth considering; agree working hours and overtime rules in writing\.$/);
    expect(s.tr).toMatch(/Değerlendirmeye değer; çalışma saatlerini ve fazla mesai kurallarını yazılı olarak netleştir\.$/);
  });

  it("names two complaints, the bigger one first, when there are several", () => {
    const s = composeSummary({ workplaceType: "SERVICE", band: 2, questions: stats("SERVICE", () => 0), categoryAverages: flat(2) });
    expect(s.en).toMatch(/The most common complaint is .+, followed by .+\./);
    expect(s.tr).toMatch(/En sık dile getirilen sorun ise .+; bunu .+ izliyor\./);
  });

  it("says the areas score alike when they are within 0.3 of each other", () => {
    const s = composeSummary({ workplaceType: "MANUAL_LABOUR", band: 4, questions: stats("MANUAL_LABOUR", () => 10), categoryAverages: flat(4.5) });
    expect(s.en).toContain("Its five areas score close to one another.");
    expect(s.en).toContain("No complaint comes up again and again.");
    expect(s.tr).toContain("Beş alanın puanları birbirine yakın.");
  });

  it("ignores questions too few people answered", () => {
    const s = composeSummary({ workplaceType: "OFFICE", band: 3, questions: stats("OFFICE", () => 0, 2), categoryAverages: flat(3) });
    expect(s.en).not.toContain("complaint");
  });
});
