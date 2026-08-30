import type { SurveyQuestionStats } from "@iwtr/shared-types";
import {
  SYSTEM_PROMPT,
  MAX_DESCRIPTION_CHARS,
  NARRATIVE_MODEL,
  PROMPT_VERSION,
  buildUserMessage,
  buildNumbersLine,
  clampToLimit,
  type NarrativeInput,
} from "../company-narrative.prompt";

const CATEGORIES = {
  corporateCulture: 3.2,
  leadership: 3.1,
  infrastructure: 3.5,
  workLifeBalance: 3.9,
  stability: 4.1,
};

const QUESTIONS: SurveyQuestionStats[] = [
  { questionId: "OFFICE.leadership.1", category: "leadership", text: "Does management micromanage?", agreeCount: 8, disagreeCount: 2, preferNotCount: 1 },
  { questionId: "OFFICE.stability.4", category: "stability", text: "Are promotions predictable?", agreeCount: 3, disagreeCount: 6, preferNotCount: 0 },
];

const INPUT: NarrativeInput = {
  workplaceType: "OFFICE",
  overall: 3.56,
  categories: CATEGORIES,
  reviewCount: 11,
  questions: QUESTIONS,
};

describe("model + prompt version", () => {
  it("pins the exact model id and prompt version", () => {
    expect(NARRATIVE_MODEL).toBe("claude-haiku-4-5");
    expect(PROMPT_VERSION).toBe(1);
  });
});

describe("SYSTEM_PROMPT", () => {
  it("states the 600-character limit and bans the filler phrases", () => {
    expect(SYSTEM_PROMPT).toContain("600");
    expect(SYSTEM_PROMPT).toContain("is a genuine strength");
    expect(SYSTEM_PROMPT).toContain("fosters a culture of");
    expect(SYSTEM_PROMPT).toContain("a testament to");
  });
});

describe("buildUserMessage", () => {
  it("includes the work-type label, overall rating, review count and every question with its counts", () => {
    const msg = buildUserMessage(INPUT);
    expect(msg).toContain("Office");
    expect(msg).toContain("3.6 out of 5");
    expect(msg).toContain("11 published employee reviews");
    expect(msg).toContain("Does management micromanage? — 8 / 2 / 1");
    expect(msg).toContain("Are promotions predictable? — 3 / 6 / 0");
  });

  it("never contains a company name field or free-text comments (none are passed in)", () => {
    const msg = buildUserMessage(INPUT);
    expect(msg.toLowerCase()).not.toContain("company name");
    expect(msg.toLowerCase()).not.toContain("generalthoughts");
  });
});

describe("buildNumbersLine", () => {
  it("names the highest and lowest category and rounds to one decimal", () => {
    const line = buildNumbersLine({ workplaceType: "OFFICE", overall: 3.56, categories: CATEGORIES, reviewCount: 11 });
    expect(line).toBe(
      "Across 11 reviews this workplace scores 3.6 out of 5. Job stability (4.1) is the strongest area and leadership (3.1) the weakest.",
    );
    expect(line.length).toBeLessThanOrEqual(MAX_DESCRIPTION_CHARS);
  });

  it("collapses to a single clause when every category is equal", () => {
    const flat = { corporateCulture: 3, leadership: 3, infrastructure: 3, workLifeBalance: 3, stability: 3 };
    const line = buildNumbersLine({ workplaceType: "SERVICE", overall: 3, categories: flat, reviewCount: 4 });
    expect(line).toBe("Across 4 reviews this workplace scores 3.0 out of 5, with all five areas rating about the same.");
  });
});

describe("clampToLimit", () => {
  it("returns short text unchanged (trimmed)", () => {
    expect(clampToLimit("  A short summary.  ")).toBe("A short summary.");
  });

  it("truncates at the last sentence boundary at or under the limit", () => {
    const text = "First sentence is fine. Second sentence pushes well past the limit and must be dropped entirely.";
    const out = clampToLimit(text, 30);
    expect(out).toBe("First sentence is fine.");
  });

  it("hard-cuts without a trailing partial word when there is no sentence boundary", () => {
    const out = clampToLimit("wordone wordtwo wordthree wordfour wordfive", 20);
    expect(out).toBe("wordone wordtwo");
    expect(out.length).toBeLessThanOrEqual(20);
  });
});
