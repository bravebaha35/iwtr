import { scoreBarColor, scoreTextColor } from "../scoreBandColors";

describe("scoreBandColors — post-relabel", () => {
  it("colours the 4.0-4.5 band (Highly Effective) lime", () => {
    expect(scoreBarColor(4.2)).toBe("bg-lime-500");
    expect(scoreTextColor(4.2)).toBe("text-lime-700 dark:text-lime-400");
  });

  it("colours the 4.5-5.0 band (Exemplary) green", () => {
    expect(scoreBarColor(4.7)).toBe("bg-green-600");
    expect(scoreTextColor(5.0)).toBe("text-green-700 dark:text-green-400");
  });

  it("still colours the low bands", () => {
    expect(scoreBarColor(1.0)).toBe("bg-red-500");
    expect(scoreBarColor(3.4)).toBe("bg-amber-500");
  });
});
