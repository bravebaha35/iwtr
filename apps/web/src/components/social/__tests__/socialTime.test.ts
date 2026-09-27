import { shortRelativeTime } from "../socialTime";

function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("shortRelativeTime", () => {
  it("never shows anything finer than an hour", () => {
    expect(shortRelativeTime(isoAgo(0))).toBe("1h ago");
    expect(shortRelativeTime(isoAgo(30_000))).toBe("1h ago");
    expect(shortRelativeTime(isoAgo(5 * MIN))).toBe("1h ago");
    expect(shortRelativeTime(isoAgo(59 * MIN))).toBe("1h ago");
    // A slightly fast server clock must not read "0h" or a negative time.
    expect(shortRelativeTime(isoAgo(-5 * MIN))).toBe("1h ago");
  });

  it("counts whole hours", () => {
    expect(shortRelativeTime(isoAgo(3 * HOUR))).toBe("3h ago");
    expect(shortRelativeTime(isoAgo(23 * HOUR + 59 * MIN))).toBe("23h ago");
  });

  it("abbreviates days", () => {
    expect(shortRelativeTime(isoAgo(2 * DAY))).toBe("2d ago");
  });

  it("abbreviates weeks once a comment is 7+ days old", () => {
    expect(shortRelativeTime(isoAgo(10 * DAY))).toBe("1w ago");
    expect(shortRelativeTime(isoAgo(20 * DAY))).toBe("2w ago");
  });

  it("abbreviates months once a comment is 30+ days old", () => {
    expect(shortRelativeTime(isoAgo(45 * DAY))).toBe("1mo ago");
    expect(shortRelativeTime(isoAgo(200 * DAY))).toBe("6mo ago");
  });

  it("abbreviates years once a comment is 365+ days old", () => {
    expect(shortRelativeTime(isoAgo(400 * DAY))).toBe("1y ago");
  });
});
