import { shortRelativeTime } from "../socialTime";

function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("shortRelativeTime", () => {
  it("shows 'just now' for under a minute", () => {
    expect(shortRelativeTime(isoAgo(30_000))).toBe("just now");
  });

  it("abbreviates minutes and hours", () => {
    expect(shortRelativeTime(isoAgo(5 * MIN))).toBe("5m");
    expect(shortRelativeTime(isoAgo(3 * HOUR))).toBe("3h");
  });

  it("abbreviates days", () => {
    expect(shortRelativeTime(isoAgo(2 * DAY))).toBe("2d");
  });

  it("abbreviates weeks once a comment is 7+ days old", () => {
    expect(shortRelativeTime(isoAgo(10 * DAY))).toBe("1w");
    expect(shortRelativeTime(isoAgo(20 * DAY))).toBe("2w");
  });

  it("abbreviates months once a comment is 30+ days old", () => {
    expect(shortRelativeTime(isoAgo(45 * DAY))).toBe("1mo");
    expect(shortRelativeTime(isoAgo(200 * DAY))).toBe("6mo");
  });

  it("abbreviates years once a comment is 365+ days old", () => {
    expect(shortRelativeTime(isoAgo(400 * DAY))).toBe("1y");
  });
});
