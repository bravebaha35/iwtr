import { categoryGroupWhere, sortBrowseRows, visibleBrowseRows, type BrowseRow } from "../company-browse.util";

const row = (name: string, city: string | null, overallAvg: number | null): BrowseRow => ({
  id: name,
  name,
  city,
  overallAvg,
  reviewCount: overallAvg === null ? 0 : 3,
  riskScore: 0,
});

const rows = [row("Çelik", "İzmir", 3), row("Acar", "Ankara", null), row("Zeki", "İstanbul", 4.5), row("Bora", "Manisa", 2)];
const names = (list: BrowseRow[]) => list.map((r) => r.name);

describe("sortBrowseRows", () => {
  it("sorts A-Z the Turkish way (Ç after C, before D)", () => {
    expect(names(sortBrowseRows(rows, "alphabetical"))).toEqual(["Acar", "Bora", "Çelik", "Zeki"]);
    expect(names(sortBrowseRows(rows, "alphabeticalDesc"))).toEqual(["Zeki", "Çelik", "Bora", "Acar"]);
  });

  it("sinks unrated workplaces to the bottom in both rating orders", () => {
    expect(names(sortBrowseRows(rows, "ratingDesc"))).toEqual(["Zeki", "Çelik", "Bora", "Acar"]);
    expect(names(sortBrowseRows(rows, "ratingAsc"))).toEqual(["Bora", "Çelik", "Zeki", "Acar"]);
  });

  it("sorts by Risk Score both ways, keeping name order on ties", () => {
    const risky = [
      { ...row("Acar", null, 3), riskScore: 1 },
      { ...row("Bora", null, 3), riskScore: 3 },
      { ...row("Çelik", null, 3), riskScore: 0 },
      { ...row("Zeki", null, 3), riskScore: 3 },
    ];
    expect(names(sortBrowseRows(risky, "riskDesc"))).toEqual(["Bora", "Zeki", "Acar", "Çelik"]);
    expect(names(sortBrowseRows(risky, "riskAsc"))).toEqual(["Çelik", "Acar", "Bora", "Zeki"]);
  });

  it("keeps the incoming order by default, or goes nearest province first for Near Me", () => {
    expect(names(sortBrowseRows(rows, "default"))).toEqual(names(rows));
    expect(names(sortBrowseRows(rows, "default", "İzmir"))).toEqual(["Çelik", "Bora", "Zeki", "Acar"]);
    expect(names(sortBrowseRows(rows, "default", "Nowhere"))).toEqual(names(rows));
  });
});

describe("visibleBrowseRows", () => {
  it("shows only reviewed workplaces by default and counts the hidden ones", () => {
    const { visible, hiddenUnratedCount } = visibleBrowseRows(rows, { sort: "default" });
    expect(names(visible)).toEqual(["Çelik", "Zeki", "Bora"]);
    expect(hiddenUnratedCount).toBe(1);
  });

  it("brings unreviewed ones in, after reviewed ones, for A-Z, Quick Select or a search", () => {
    for (const opts of [{ sort: "alphabetical" as const }, { sort: "default" as const, categoryGroup: "FIRMS" as const }, { sort: "default" as const, q: "a" }]) {
      const { visible, hiddenUnratedCount } = visibleBrowseRows(rows, opts);
      expect(names(visible)).toEqual(["Çelik", "Zeki", "Bora", "Acar"]);
      expect(hiddenUnratedCount).toBe(0);
    }
  });
});

describe("categoryGroupWhere", () => {
  it("matches one category per group, and everything else for Firms", () => {
    expect(categoryGroupWhere(undefined)).toEqual({});
    expect(categoryGroupWhere("SUPERMARKET")).toEqual({ category: "Supermarket" });
    expect(categoryGroupWhere("FIRMS")).toEqual({
      category: { notIn: ["Supermarket", "Franchise", "Logistics", "Clothing Retail", "Telecom", "Fuel & Energy"] },
    });
  });
});
