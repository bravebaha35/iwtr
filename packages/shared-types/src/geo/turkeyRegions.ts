import { z } from "zod";
import { TURKEY_PROVINCES, normalizeCityName, type TurkeyProvince } from "./turkey";

// Turkey's 7 official statistical regions (Bölge), each listing every
// province it contains by name (must match TurkeyProvince.name exactly —
// asserted in __tests__/turkeyRegions.test.ts so the two tables can't drift
// apart). Mirrors the Prisma `TurkeyRegion` enum in schema.prisma 1:1 — this
// is the single source of truth for the enum's Turkish display label and its
// province membership; the enum itself only needs ASCII identifiers.
export const TURKEY_REGIONS = [
  {
    key: "MARMARA",
    label: "Marmara",
    provinces: ["İstanbul", "Bursa", "Kocaeli", "Balıkesir", "Çanakkale", "Tekirdağ", "Edirne", "Kırklareli", "Sakarya", "Yalova", "Bilecik"],
  },
  {
    key: "EGE",
    label: "Ege",
    provinces: ["İzmir", "Manisa", "Aydın", "Denizli", "Muğla", "Afyonkarahisar", "Kütahya", "Uşak"],
  },
  {
    key: "AKDENIZ",
    label: "Akdeniz",
    provinces: ["Antalya", "Adana", "Mersin", "Hatay", "Isparta", "Burdur", "Kahramanmaraş", "Osmaniye"],
  },
  {
    key: "IC_ANADOLU",
    label: "İç Anadolu",
    provinces: ["Ankara", "Konya", "Kayseri", "Sivas", "Eskişehir", "Yozgat", "Kırıkkale", "Aksaray", "Karaman", "Kırşehir", "Nevşehir", "Niğde", "Çankırı"],
  },
  {
    key: "KARADENIZ",
    label: "Karadeniz",
    provinces: ["Samsun", "Trabzon", "Ordu", "Giresun", "Rize", "Artvin", "Zonguldak", "Kastamonu", "Sinop", "Amasya", "Çorum", "Tokat", "Bolu", "Düzce", "Bartın", "Karabük", "Gümüşhane", "Bayburt"],
  },
  {
    key: "DOGU_ANADOLU",
    label: "Doğu Anadolu",
    provinces: ["Erzurum", "Van", "Malatya", "Elazığ", "Ağrı", "Kars", "Ardahan", "Iğdır", "Erzincan", "Bingöl", "Bitlis", "Hakkari", "Muş", "Tunceli"],
  },
  {
    key: "GUNEYDOGU_ANADOLU",
    label: "Güneydoğu Anadolu",
    provinces: ["Gaziantep", "Şanlıurfa", "Diyarbakır", "Mardin", "Batman", "Siirt", "Şırnak", "Kilis", "Adıyaman"],
  },
] as const;

export type TurkeyRegionKey = (typeof TURKEY_REGIONS)[number]["key"];

// Mirrors the Prisma `TurkeyRegion` enum's exact value set — kept in sync by
// __tests__/turkeyRegions.test.ts asserting it matches TURKEY_REGIONS' own keys.
export const turkeyRegionKeySchema = z.enum([
  "MARMARA",
  "EGE",
  "AKDENIZ",
  "IC_ANADOLU",
  "KARADENIZ",
  "DOGU_ANADOLU",
  "GUNEYDOGU_ANADOLU",
]);

const REGION_BY_KEY = new Map(TURKEY_REGIONS.map((r) => [r.key, r]));
const REGION_KEY_BY_NORMALIZED_PROVINCE = new Map(
  TURKEY_REGIONS.flatMap((r) => r.provinces.map((p) => [normalizeCityName(p), r.key])),
);

export function regionLabel(key: TurkeyRegionKey): string {
  return REGION_BY_KEY.get(key)?.label ?? key;
}

// Real TurkeyProvince rows (with their own district lists) for a region —
// what a REGION_BASED company's "Choose the City" review dropdown populates
// from (see PatternGeneratorService-style separation: this module only ever
// returns data, apps/web decides how to render it).
export function provincesInRegion(key: TurkeyRegionKey): TurkeyProvince[] {
  const region = REGION_BY_KEY.get(key);
  if (!region) return [];
  const names = new Set(region.provinces.map(normalizeCityName));
  return TURKEY_PROVINCES.filter((p) => names.has(normalizeCityName(p.name)));
}

export function findRegionByProvinceName(provinceName: string | null | undefined): TurkeyRegionKey | null {
  if (!provinceName) return null;
  return REGION_KEY_BY_NORMALIZED_PROVINCE.get(normalizeCityName(provinceName)) ?? null;
}
