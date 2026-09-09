import { RATING_TICKS, activeMoodIndex } from "../beaverRating";

describe("beaverRating", () => {
  it("has 3 ticks at 0 / 2.5 / 5", () => {
    expect(RATING_TICKS.map((t) => t.value)).toEqual([0, 2.5, 5]);
  });
  it("splits 0-5 into even thirds", () => {
    expect(activeMoodIndex(0)).toBe(0);
    expect(activeMoodIndex(1.6)).toBe(0);
    expect(activeMoodIndex(2.5)).toBe(1);
    expect(activeMoodIndex(3.3)).toBe(1);
    expect(activeMoodIndex(3.4)).toBe(2);
    expect(activeMoodIndex(5)).toBe(2);
  });
});
