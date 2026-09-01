import { buildNumbersLine } from "../numbers-line";

const CATEGORIES = {
  corporateCulture: 3.2,
  leadership: 3.1,
  infrastructure: 3.5,
  workLifeBalance: 3.9,
  stability: 4.1,
};

describe("buildNumbersLine", () => {
  it("names the highest and lowest category and rounds to one decimal", () => {
    const line = buildNumbersLine({ workplaceType: "OFFICE", overall: 3.56, categories: CATEGORIES, reviewCount: 11 });
    expect(line).toBe(
      "Across 11 reviews this workplace scores 3.6 out of 5. Job stability (4.1) is the strongest area and leadership (3.1) the weakest.",
    );
  });

  it("collapses to a single clause when every category is equal", () => {
    const flat = { corporateCulture: 3, leadership: 3, infrastructure: 3, workLifeBalance: 3, stability: 3 };
    const line = buildNumbersLine({ workplaceType: "SERVICE", overall: 3, categories: flat, reviewCount: 4 });
    expect(line).toBe("Across 4 reviews this workplace scores 3.0 out of 5, with all five areas rating about the same.");
  });
});
