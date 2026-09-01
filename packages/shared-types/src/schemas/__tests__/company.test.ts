import { adminCreateCompanyInputSchema } from "../company";

function base(overrides: Record<string, unknown> = {}) {
  return {
    name: "Acme",
    category: "Logistics",
    workplaceTypes: ["MANUAL_LABOUR"],
    ...overrides,
  };
}

describe("adminCreateCompanyInputSchema — structureType/region/city consistency", () => {
  it("accepts a SETTLED company with no structureType at all (the default)", () => {
    expect(adminCreateCompanyInputSchema.safeParse(base({ city: "İstanbul" })).success).toBe(true);
  });

  it("rejects a SETTLED company carrying a region", () => {
    const result = adminCreateCompanyInputSchema.safeParse(base({ region: "MARMARA" }));
    expect(result.success).toBe(false);
  });

  it("requires a city for CITY_BASED", () => {
    const result = adminCreateCompanyInputSchema.safeParse(base({ structureType: "CITY_BASED" }));
    expect(result.success).toBe(false);
  });

  it("accepts a valid CITY_BASED company", () => {
    const result = adminCreateCompanyInputSchema.safeParse(base({ structureType: "CITY_BASED", city: "İstanbul" }));
    expect(result.success).toBe(true);
  });

  it("rejects a CITY_BASED company that also carries a region", () => {
    const result = adminCreateCompanyInputSchema.safeParse(
      base({ structureType: "CITY_BASED", city: "İstanbul", region: "MARMARA" }),
    );
    expect(result.success).toBe(false);
  });

  it("requires a region for REGION_BASED", () => {
    const result = adminCreateCompanyInputSchema.safeParse(base({ structureType: "REGION_BASED" }));
    expect(result.success).toBe(false);
  });

  it("rejects a REGION_BASED company that also carries a city", () => {
    const result = adminCreateCompanyInputSchema.safeParse(
      base({ structureType: "REGION_BASED", region: "MARMARA", city: "İstanbul" }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a valid REGION_BASED company", () => {
    const result = adminCreateCompanyInputSchema.safeParse(base({ structureType: "REGION_BASED", region: "MARMARA" }));
    expect(result.success).toBe(true);
  });
});
