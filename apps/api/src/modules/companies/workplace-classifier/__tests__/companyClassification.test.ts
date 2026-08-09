import { classifyJobRole, inferCompanyWorkplaceTypes } from "../classifyJobRole";

describe("classifyJobRole", () => {
  it("classifies Veri Bilimci as HYBRID_REMOTE", () => {
    expect(classifyJobRole("Veri Bilimci")).toBe("HYBRID_REMOTE");
  });

  it("classifies Asansör Bakım Ustası as MANUAL_LABOUR", () => {
    expect(classifyJobRole("Asansör Bakım Ustası")).toBe("MANUAL_LABOUR");
  });

  it.each([
    ["Diş Hekimi", "SERVICE"],
    ["CEO", "OFFICE"],
    ["Kuaför", "SERVICE"],
    ["Güvenlik Görevlisi", "MANUAL_LABOUR"],
    ["İnsan Kaynakları", "OFFICE"],
    ["Hemşire", "SERVICE"],
  ] as const)("classifies %s as %s", (title, expected) => {
    expect(classifyJobRole(title)).toBe(expected);
  });

  it("returns null (not a fallback guess) when nothing matches", () => {
    expect(classifyJobRole("asdkfjasdf")).toBeNull();
  });
});

describe("inferCompanyWorkplaceTypes", () => {
  it.each([
    ["Hastane / Sağlık", ["SERVICE", "OFFICE"]],
    ["Üretim / Fabrika", ["MANUAL_LABOUR", "OFFICE"]],
    ["Yazılım / Bilişim", ["HYBRID_REMOTE", "OFFICE"]],
  ] as const)("applies the %s sector override", (sector, expected) => {
    expect(inferCompanyWorkplaceTypes(sector)).toEqual(expected);
  });

  it("sector override matching is case/locale-insensitive", () => {
    expect(inferCompanyWorkplaceTypes("HASTANE / SAĞLIK")).toEqual(["SERVICE", "OFFICE"]);
  });

  it("falls back to classifying job roles when the sector has no override", () => {
    // Deliberate deviation from the original spec's example, which expected
    // all 3 of [SERVICE, MANUAL_LABOUR, OFFICE] — capped to the first 2
    // distinct results per the "max 2 tags per company" product decision.
    // "Hastane" alone (no "/ Sağlık") also intentionally does NOT hit the
    // sector-override table above, so this exercises the job-roles path.
    expect(inferCompanyWorkplaceTypes("Hastane", ["Hemşire", "Güvenlik Görevlisi", "İnsan Kaynakları"])).toEqual([
      "SERVICE",
      "MANUAL_LABOUR",
    ]);
  });

  it("deduplicates repeated categories among job roles", () => {
    expect(inferCompanyWorkplaceTypes("Bilinmeyen Sektör", ["Hemşire", "Doktor", "Garson"])).toEqual(["SERVICE"]);
  });

  it("ignores job roles that don't classify to anything", () => {
    expect(inferCompanyWorkplaceTypes("Bilinmeyen Sektör", ["asdkfjasdf", "Hemşire"])).toEqual(["SERVICE"]);
  });

  it("returns an empty array for an unknown sector with no job roles given", () => {
    expect(inferCompanyWorkplaceTypes("Bilinmeyen Sektör")).toEqual([]);
  });

  it("never returns more than 2 results", () => {
    const result = inferCompanyWorkplaceTypes("Bilinmeyen Sektör", [
      "Hemşire", // SERVICE
      "Kaynakçı", // MANUAL_LABOUR
      "Avukat", // OFFICE
      "Backend Developer", // HYBRID_REMOTE
    ]);
    expect(result.length).toBeLessThanOrEqual(2);
  });
});
