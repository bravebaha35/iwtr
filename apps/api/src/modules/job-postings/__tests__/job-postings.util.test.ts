import {
  effectivePostDate,
  liveEndDate,
  daysRemaining,
  daysPastLiveEnd,
  isWithinSavedGraceWindow,
  shouldLazyReshare,
  type PostingLifecycleFields,
} from "../job-postings.util";

function posting(overrides: Partial<PostingLifecycleFields> = {}): PostingLifecycleFields {
  return {
    status: "PUBLISHED",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    lastResharedAt: null,
    filledAt: null,
    autoReshareEnabled: false,
    ...overrides,
  };
}

describe("effectivePostDate", () => {
  it("uses createdAt when never reshared", () => {
    expect(effectivePostDate(posting())).toEqual(new Date("2026-01-01T00:00:00Z"));
  });
  it("uses lastResharedAt when set", () => {
    const reshared = new Date("2026-02-01T00:00:00Z");
    expect(effectivePostDate(posting({ lastResharedAt: reshared }))).toEqual(reshared);
  });
});

describe("liveEndDate", () => {
  it("is 30 days after the effective post date for a PUBLISHED posting", () => {
    expect(liveEndDate(posting())).toEqual(new Date("2026-01-31T00:00:00Z"));
  });
  it("is filledAt for a FILLED posting", () => {
    const filled = new Date("2026-01-10T00:00:00Z");
    expect(liveEndDate(posting({ status: "FILLED", filledAt: filled }))).toEqual(filled);
  });
});

describe("daysRemaining", () => {
  it("counts down toward 30 days from the effective post date", () => {
    const now = new Date("2026-01-11T00:00:00Z"); // 10 days after createdAt
    expect(daysRemaining(posting(), now)).toBe(20);
  });
  it("is 0 once past the live end", () => {
    const now = new Date("2026-02-05T00:00:00Z");
    expect(daysRemaining(posting(), now)).toBe(0);
  });
  it("is always 0 for a non-PUBLISHED posting, regardless of dates", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    expect(daysRemaining(posting({ status: "FILLED", filledAt: new Date("2026-01-01T00:00:00Z") }), now)).toBe(0);
  });
});

describe("daysPastLiveEnd / isWithinSavedGraceWindow", () => {
  it("a still-live PUBLISHED posting is within the grace window (daysPastLiveEnd 0)", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    expect(daysPastLiveEnd(posting(), now)).toBe(0);
    expect(isWithinSavedGraceWindow(posting(), now)).toBe(true);
  });
  it("stays within the grace window up to 30 days after the live end", () => {
    const now = new Date("2026-02-28T00:00:00Z"); // 28 days past the Jan 31 live end
    expect(isWithinSavedGraceWindow(posting(), now)).toBe(true);
  });
  it("falls out of the grace window past 30 days after the live end", () => {
    const now = new Date("2026-03-15T00:00:00Z"); // 43 days past the Jan 31 live end
    expect(isWithinSavedGraceWindow(posting(), now)).toBe(false);
  });
  it("grace window for a FILLED posting counts from filledAt, not createdAt", () => {
    const filled = new Date("2026-01-05T00:00:00Z"); // only 4 days into its life
    const now = new Date("2026-01-20T00:00:00Z"); // 15 days after filledAt
    expect(isWithinSavedGraceWindow(posting({ status: "FILLED", filledAt: filled }), now)).toBe(true);
  });
});

describe("shouldLazyReshare", () => {
  it("true only when PUBLISHED, autoReshareEnabled, and daysRemaining is 0", () => {
    const now = new Date("2026-02-05T00:00:00Z"); // past the 30-day live end
    expect(shouldLazyReshare(posting({ autoReshareEnabled: true }), now)).toBe(true);
    expect(shouldLazyReshare(posting({ autoReshareEnabled: false }), now)).toBe(false);
    expect(shouldLazyReshare(posting({ autoReshareEnabled: true, status: "FILLED", filledAt: new Date() }), now)).toBe(
      false,
    );
  });
  it("false while still within the 30-day live window even if autoReshareEnabled", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    expect(shouldLazyReshare(posting({ autoReshareEnabled: true }), now)).toBe(false);
  });
});
