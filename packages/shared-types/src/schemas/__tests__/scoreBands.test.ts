import { scoreBandLabel } from "../company";

describe("scoreBandLabel — 2026-08-30 relabel", () => {
  it.each([
    [0, "Unsatisfactory"],
    [1.9, "Unsatisfactory"],
    [2.0, "Developing"],
    [2.9, "Developing"],
    [3.0, "Effective"],
    [3.9, "Effective"],
    [4.0, "Highly Effective"],
    [4.49, "Highly Effective"],
    [4.5, "Exemplary"],
    [4.8, "Exemplary"],
    [5.0, "Exemplary"],
  ])("maps %p to %p", (avg, label) => {
    expect(scoreBandLabel(avg)).toBe(label);
  });

  it("no longer produces the old labels", () => {
    const labels = new Set([0, 2, 3, 4, 4.5, 5].map(scoreBandLabel));
    expect(labels.has("Superb")).toBe(false);
  });
});
