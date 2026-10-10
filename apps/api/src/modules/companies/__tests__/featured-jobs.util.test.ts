import { pickFeatured, type FeaturedCandidate } from "../featured-jobs.util";

let n = 0;
const ad = (city: string, over: Partial<FeaturedCandidate> = {}): FeaturedCandidate => ({
  id: `p${n++}`,
  companyId: `c${n}`,
  city,
  district: null,
  category: "Logistics",
  workType: "MANUAL_LABOUR",
  ...over,
});
const base = { cities: [], districts: [], limit: 8, minLocal: 4 };
const cities = (picked: FeaturedCandidate[]) => picked.map((p) => p.city);

describe("pickFeatured", () => {
  it("with no place chosen, shows up to 8 from anywhere", () => {
    const all = Array.from({ length: 12 }, (_, i) => ad(i % 2 ? "Ankara" : "Diyarbakır"));
    expect(pickFeatured(all, base)).toHaveLength(8);
  });

  it("with İzmir chosen, shows only İzmir when it has 4 or more", () => {
    const all = [ad("İzmir"), ad("İzmir"), ad("İzmir"), ad("İzmir"), ad("Manisa"), ad("Diyarbakır")];
    expect(new Set(cities(pickFeatured(all, { ...base, cities: ["İzmir"] })))).toEqual(new Set(["İzmir"]));
  });

  it("tops İzmir up from the Aegean region (Manisa, Aydın) - never from outside it", () => {
    const all = [ad("İzmir"), ad("Manisa"), ad("Aydın"), ad("Diyarbakır"), ad("Ankara")];
    const picked = cities(pickFeatured(all, { ...base, cities: ["İzmir"] }));
    expect(picked[0]).toBe("İzmir");
    expect(new Set(picked)).toEqual(new Set(["İzmir", "Manisa", "Aydın"]));
  });

  it("shows regional ads when the chosen city has none", () => {
    const all = [ad("Manisa"), ad("Diyarbakır")];
    expect(cities(pickFeatured(all, { ...base, cities: ["İzmir"] }))).toEqual(["Manisa"]);
  });

  it("puts the member's own sector first, then their kind of work, then everything", () => {
    const it1 = ad("İstanbul", { category: "IT", workType: "OFFICE" });
    const office = ad("İstanbul", { category: "Consulting", workType: "OFFICE" });
    const manual = ad("İstanbul", { category: "Logistics", workType: "MANUAL_LABOUR" });
    const all = [it1, office, manual];
    expect(pickFeatured(all, { ...base, forSector: "IT", forWorkType: "OFFICE" })).toEqual([it1]);
    expect(new Set(pickFeatured(all, { ...base, forSector: "Retail", forWorkType: "OFFICE" }))).toEqual(new Set([it1, office]));
    expect(pickFeatured(all, { ...base, forSector: "Retail", forWorkType: "SERVICE" })).toHaveLength(3);
  });

  it("drops the member's field rather than show an empty row in the chosen place", () => {
    const all = [ad("İzmir", { category: "Logistics" }), ad("Ankara", { category: "IT" })];
    expect(cities(pickFeatured(all, { ...base, cities: ["İzmir"], forSector: "IT" }))).toEqual(["İzmir"]);
  });
});
