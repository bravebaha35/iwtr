import { classifyWorkplace } from "../classifyJobRole";

describe("classifyWorkplace", () => {
  // The exact examples from the classification spec.
  it.each([
    ["Çiğli OSB Makine Operatörü", "MANUAL_LABOUR"],
    ["Uzaktan React Developer", "HYBRID_REMOTE"],
    ["Özel Hastane Tıbbi Sekreter", "SERVICE"],
    ["Mali Müşavir", "OFFICE"],
  ] as const)("classifies %s as %s", (title, expected) => {
    expect(classifyWorkplace(title).workplaceType).toBe(expected);
  });

  describe("OFFICE", () => {
    it.each([
      ["Finansal Analist", "Finance, Accounting & Audit"],
      ["İnsan Kaynakları Uzmanı", "HR & Admin"],
      ["Avukat", "Legal & Compliance"],
      ["Banka Gişe Yetkilisi", "Banking Branch & Ops"],
      ["Gayrimenkul Danışmanı", "Real Estate / Property"],
    ])("classifies %s as OFFICE / %s", (title, sector) => {
      const result = classifyWorkplace(title);
      expect(result.workplaceType).toBe("OFFICE");
      expect(result.matchedSector).toBe(sector);
    });
  });

  describe("HYBRID_REMOTE", () => {
    it.each([
      ["Backend Developer", "Software & Tech"],
      ["Dijital Pazarlama Uzmanı", "Digital Marketing & Content"],
      ["Ürün Yöneticisi", "Product & Design"],
      ["Müşteri Başarısı Uzmanı", "Remote Support"],
      ["Pazaryeri Yöneticisi", "E-Commerce Operations"],
    ])("classifies %s as HYBRID_REMOTE / %s", (title, sector) => {
      const result = classifyWorkplace(title);
      expect(result.workplaceType).toBe("HYBRID_REMOTE");
      expect(result.matchedSector).toBe(sector);
    });
  });

  describe("SERVICE", () => {
    it.each([
      ["Hemşire", "Healthcare & Hospitals"],
      ["Mağaza Müdürü", "Retail & Stores"],
      ["Garson", "Hospitality & Gastronomy"],
      ["Saha Satış Temsilcisi", "Field Sales"],
      ["Dershane Eğitmeni", "Private Education"],
      ["Estetisyen", "Wellness"],
    ])("classifies %s as SERVICE / %s", (title, sector) => {
      const result = classifyWorkplace(title);
      expect(result.workplaceType).toBe("SERVICE");
      expect(result.matchedSector).toBe(sector);
    });
  });

  describe("MANUAL_LABOUR", () => {
    it.each([
      ["Forklift Operatörü", "Logistics & Delivery"],
      ["Kaynakçı", "Manufacturing & Industrial (OSB)"],
      ["Şantiye İşçisi", "Construction & Sites"],
      ["Oto Tamircisi", "Maintenance"],
      ["Özel Güvenlik Görevlisi", "Facility & Security"],
    ])("classifies %s as MANUAL_LABOUR / %s", (title, sector) => {
      const result = classifyWorkplace(title);
      expect(result.workplaceType).toBe("MANUAL_LABOUR");
      expect(result.matchedSector).toBe(sector);
    });
  });

  it("is case-insensitive and TR-locale-aware (İ/I, ı/i)", () => {
    expect(classifyWorkplace("MALİ MÜŞAVİR").workplaceType).toBe("OFFICE");
    expect(classifyWorkplace("mali müşavir").workplaceType).toBe("OFFICE");
  });

  it("still matches keywords typed without Turkish diacritics", () => {
    // "muhasebeci" ASCII-typed, no ç/ş/ı — should still hit "Muhasebe".
    expect(classifyWorkplace("Sirket Muhasebe Sorumlusu").workplaceType).toBe("OFFICE");
  });

  it("uses word boundaries, not substring matching", () => {
    // "SEO" is a real keyword; it must not match merely because it's a
    // substring of an unrelated word like "Seoul" — same Unicode-boundary
    // technique that fixes the "amir" inside "tamir" false-positive in
    // moderation.service.ts.
    const result = classifyWorkplace("Seoul ofis binası");
    expect(result.confidenceScore).toBe(0);
  });

  it("does not loosely match on a word shared across multiple longer keyword phrases", () => {
    // "Yöneticisi" (manager) alone is part of several keywords ("Ofis
    // Yöneticisi", "Ürün Yöneticisi", ...) but "Saha Yöneticisi" isn't one
    // of the exact phrases in the map — matching must be phrase-level, not
    // "any word in the phrase matches".
    const result = classifyWorkplace("Saha Yöneticisi");
    expect(result.confidenceScore).toBe(0);
  });

  it("combines title, sector, and description into one match pass", () => {
    const result = classifyWorkplace("Uzman", "Yazılım", "Backend geliştirme ekibinde çalışacak");
    expect(result.workplaceType).toBe("HYBRID_REMOTE");
  });

  it("falls back to SERVICE with zero confidence on empty input", () => {
    const result = classifyWorkplace("");
    expect(result).toEqual({ workplaceType: "SERVICE", confidenceScore: 0, matchedSector: "Unclassified" });
  });

  it("falls back to SERVICE with zero confidence when nothing matches", () => {
    const result = classifyWorkplace("Genel Müdürlük");
    expect(result.workplaceType).toBe("SERVICE");
    expect(result.confidenceScore).toBe(0);
    expect(result.matchedSector).toBe("Unclassified");
  });

  it("raises confidence with additional keyword hits in the same sector", () => {
    const single = classifyWorkplace("Aşçı");
    const double = classifyWorkplace("Aşçı ve Garson aranıyor");
    expect(double.confidenceScore).toBeGreaterThan(single.confidenceScore);
  });

  it("never returns a confidence outside [0, 1]", () => {
    const result = classifyWorkplace(
      "Garson Komi Aşçı Resepsiyonist Kat Hizmetleri Tur Rehberi Saha Satış Temsilcisi",
    );
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(1);
  });
});
