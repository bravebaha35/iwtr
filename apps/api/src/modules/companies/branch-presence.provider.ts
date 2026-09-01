import { TURKEY_PROVINCES, type TurkeyRegionKey } from "@iwtr/shared-types";

/**
 * Verifies where a nationwide brand actually has a branch before a
 * CITY_BASED/REGION_BASED seed script creates a node for it — the whole
 * point being to never create a dead page (e.g. a "Starbucks Hakkari
 * Şubeleri" company with zero real presence there). A real implementation
 * would call a franchise-locator/maps API; this interface exists so that
 * swap can happen later without touching the seed script that consumes it.
 */
export interface BranchPresenceProvider {
  /** Real province names (must match TURKEY_PROVINCES entries) where this CITY_BASED brand operates. */
  getCityPresence(brandName: string): string[];
  /** Regions where this REGION_BASED brand operates. */
  getRegionPresence(brandName: string): TurkeyRegionKey[];
}

const ALL_PROVINCE_NAMES: string[] = TURKEY_PROVINCES.map((p) => p.name);
const EXCLUDING = (...excluded: string[]) => ALL_PROVINCE_NAMES.filter((p) => !excluded.includes(p));

// Best-effort real-world approximations, not a live-verified dataset (see
// the interface doc comment above) — deliberately uneven per brand so the
// seed script's "skip where there's no real presence" logic has something
// real to demonstrate, the same way the task's own Starbucks example does.
const CITY_PRESENCE: Record<string, string[]> = {
  "Yurtiçi Kargo": ALL_PROVINCE_NAMES,
  "Aras Kargo": ALL_PROVINCE_NAMES,
  "DHL Kargo": [
    "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Gaziantep", "Konya", "Kayseri", "Mersin",
    "Kocaeli", "Eskişehir", "Samsun", "Denizli", "Trabzon", "Şanlıurfa", "Diyarbakır", "Muğla", "Manisa", "Balıkesir",
  ],
  "Trendyol Express": ALL_PROVINCE_NAMES,
  HepsiJet: ALL_PROVINCE_NAMES,
  A101: ALL_PROVINCE_NAMES,
  BİM: ALL_PROVINCE_NAMES,
  "ŞOK Market": ALL_PROVINCE_NAMES,
  Migros: ALL_PROVINCE_NAMES,
  "Tarım Kredi Kooperatif Market": ALL_PROVINCE_NAMES,
  "Türk Telekom": ALL_PROVINCE_NAMES,
  "Turkcell Superonline": [
    "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Gaziantep", "Konya", "Kayseri", "Mersin",
    "Kocaeli", "Eskişehir", "Samsun", "Denizli", "Trabzon", "Muğla", "Manisa", "Balıkesir", "Aydın", "Tekirdağ",
    "Sakarya", "Kahramanmaraş", "Van", "Malatya", "Elazığ", "Erzurum", "Şanlıurfa", "Diyarbakır", "Mardin", "Ordu",
  ],
  Vodafone: [
    "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Gaziantep", "Konya", "Kayseri", "Mersin",
    "Kocaeli", "Eskişehir", "Samsun", "Denizli", "Trabzon", "Muğla", "Manisa", "Balıkesir", "Aydın", "Tekirdağ",
    "Sakarya", "Kahramanmaraş", "Şanlıurfa", "Diyarbakır", "Malatya", "Erzurum", "Hatay", "Elazığ", "Van", "Ordu",
    "Afyonkarahisar", "Çanakkale", "Edirne", "Isparta", "Sivas",
  ],
  "LC Waikiki": EXCLUDING("Bayburt", "Ardahan", "Hakkari", "Şırnak", "Tunceli", "Kilis"),
  DeFacto: EXCLUDING("Bayburt", "Ardahan", "Hakkari", "Şırnak", "Tunceli", "Kilis"),
  Koton: EXCLUDING("Bayburt", "Ardahan", "Hakkari", "Şırnak", "Tunceli", "Kilis", "Iğdır", "Gümüşhane"),
  Starbucks: [
    "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Gaziantep", "Konya", "Kayseri", "Eskişehir",
    "Mersin", "Kocaeli", "Muğla", "Trabzon", "Şanlıurfa", "Diyarbakır", "Samsun",
  ],
  "Burger King": EXCLUDING(
    "Bayburt", "Ardahan", "Hakkari", "Şırnak", "Tunceli", "Iğdır", "Gümüşhane", "Kilis", "Bingöl", "Bitlis",
    "Muş", "Siirt", "Batman", "Artvin", "Kars", "Ağrı", "Sinop", "Bartın",
  ),
};

const REGION_PRESENCE: Record<string, TurkeyRegionKey[]> = {
  Sendeo: ["MARMARA", "EGE", "IC_ANADOLU"],
  "Kolay Gelsin": ["MARMARA", "EGE", "AKDENIZ", "IC_ANADOLU"],
  "UPS Kargo": ["MARMARA", "EGE", "AKDENIZ", "IC_ANADOLU", "KARADENIZ"],
  "Seç Market": ["MARMARA", "IC_ANADOLU"],
  TurkNet: ["MARMARA", "EGE", "AKDENIZ", "IC_ANADOLU", "KARADENIZ", "GUNEYDOGU_ANADOLU"],
  TotalEnergies: ["MARMARA", "EGE", "AKDENIZ", "IC_ANADOLU", "KARADENIZ"],
  "Petrol Ofisi": ["MARMARA", "EGE", "AKDENIZ", "IC_ANADOLU", "KARADENIZ", "DOGU_ANADOLU", "GUNEYDOGU_ANADOLU"],
  Opet: ["MARMARA", "EGE", "AKDENIZ", "IC_ANADOLU", "KARADENIZ", "DOGU_ANADOLU", "GUNEYDOGU_ANADOLU"],
  Shell: ["MARMARA", "EGE", "AKDENIZ", "IC_ANADOLU", "KARADENIZ", "DOGU_ANADOLU", "GUNEYDOGU_ANADOLU"],
  "Türkiye Petrolleri": ["MARMARA", "EGE", "AKDENIZ", "IC_ANADOLU", "KARADENIZ", "DOGU_ANADOLU", "GUNEYDOGU_ANADOLU"],
};

export class MockBranchPresenceProvider implements BranchPresenceProvider {
  getCityPresence(brandName: string): string[] {
    return CITY_PRESENCE[brandName] ?? [];
  }

  getRegionPresence(brandName: string): TurkeyRegionKey[] {
    return REGION_PRESENCE[brandName] ?? [];
  }
}
