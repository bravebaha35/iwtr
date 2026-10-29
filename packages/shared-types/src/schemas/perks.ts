import { z } from "zod";

// Company perks ("Yan Haklar", 2026-10-29). Owners never type a perk: they
// pick from this catalogue (a search box suggests as they type, in either
// language), so every perk has one key, one English and one Turkish name and
// one symbol (the symbol lives in apps/web, lib/perkIcons.tsx).
//
// Compiled from what Turkish employers commonly list under "Yan Haklar" /
// "Sosyal Haklar" on job sites and in HR surveys (meal card, shuttle, private
// health insurance, BES, ikramiye, erzak, yakacak, kreş ...) plus the usual
// international ones. Stored on Company.perks as these keys; a key that is
// later removed from here is simply dropped on read.
//
// Order here is the display order (grouped: food, transport, health, money,
// time off, way of working, growth, family, workplace).

export type PerkGroup = "food" | "transport" | "health" | "money" | "time" | "work" | "growth" | "family" | "workplace";

export interface PerkDefinition {
  key: string;
  en: string;
  tr: string;
  group: PerkGroup;
}

export const PERK_CATALOG = [
  // Food
  { key: "MEAL_CARD", en: "Meal card", tr: "Yemek Kartı", group: "food" },
  { key: "CAFETERIA", en: "Free meals at work", tr: "Yemekhane", group: "food" },
  { key: "MEAL_ALLOWANCE", en: "Cash meal allowance", tr: "Nakit Yemek Ücreti", group: "food" },
  { key: "COFFEE_SNACKS", en: "Free coffee and snacks", tr: "Ücretsiz Kahve ve Atıştırmalık", group: "food" },
  { key: "FOOD_PACKAGE", en: "Food package", tr: "Erzak Yardımı", group: "food" },
  // Transport
  { key: "SHUTTLE", en: "Company shuttle", tr: "Servis", group: "transport" },
  { key: "TRAVEL_ALLOWANCE", en: "Travel allowance", tr: "Yol Ücreti", group: "transport" },
  { key: "TRANSIT_CARD", en: "Public transport card", tr: "Toplu Taşıma Kartı", group: "transport" },
  { key: "COMPANY_CAR", en: "Company car", tr: "Şirket Aracı", group: "transport" },
  { key: "FUEL_CARD", en: "Fuel card", tr: "Yakıt Kartı", group: "transport" },
  { key: "FREE_PARKING", en: "Free parking", tr: "Ücretsiz Otopark", group: "transport" },
  { key: "BIKE_SUPPORT", en: "Bike to work support", tr: "Bisiklet Desteği", group: "transport" },
  // Health
  { key: "PRIVATE_HEALTH_INSURANCE", en: "Private health insurance", tr: "Özel Sağlık Sigortası", group: "health" },
  { key: "FAMILY_HEALTH_INSURANCE", en: "Health insurance for family", tr: "Aile Sağlık Sigortası", group: "health" },
  { key: "LIFE_INSURANCE", en: "Life insurance", tr: "Hayat Sigortası", group: "health" },
  { key: "ACCIDENT_INSURANCE", en: "Personal accident insurance", tr: "Ferdi Kaza Sigortası", group: "health" },
  { key: "DENTAL", en: "Dental care support", tr: "Diş Sağlığı Desteği", group: "health" },
  { key: "HEALTH_UNIT", en: "On-site health unit", tr: "Revir", group: "health" },
  { key: "ANNUAL_CHECKUP", en: "Annual check-up", tr: "Yıllık Check-up", group: "health" },
  { key: "PSYCH_SUPPORT", en: "Psychological support", tr: "Psikolojik Danışmanlık", group: "health" },
  { key: "GYM", en: "Gym membership", tr: "Spor Salonu Üyeliği", group: "health" },
  // Money
  { key: "PERFORMANCE_BONUS", en: "Performance bonus", tr: "Performans Primi", group: "money" },
  { key: "EXTRA_SALARIES", en: "Extra salary payments", tr: "İkramiye", group: "money" },
  { key: "SALES_COMMISSION", en: "Sales commission", tr: "Satış Primi", group: "money" },
  { key: "HOLIDAY_BONUS", en: "Holiday bonus", tr: "Bayram Harçlığı", group: "money" },
  { key: "PRIVATE_PENSION", en: "Private pension (BES) contribution", tr: "BES Katkı Payı", group: "money" },
  { key: "HEATING_ALLOWANCE", en: "Heating allowance", tr: "Yakacak Yardımı", group: "money" },
  { key: "STOCK_OPTIONS", en: "Stock options", tr: "Hisse Opsiyonu", group: "money" },
  { key: "GIFT_CARDS", en: "Gift cards", tr: "Hediye Çeki", group: "money" },
  { key: "EMPLOYEE_DISCOUNT", en: "Employee discount", tr: "Personel İndirimi", group: "money" },
  { key: "SALARY_ADVANCE", en: "Salary advance", tr: "Maaş Avansı", group: "money" },
  { key: "REFERRAL_BONUS", en: "Referral bonus", tr: "Personel Tavsiye Primi", group: "money" },
  // Time off
  { key: "EXTRA_ANNUAL_LEAVE", en: "Extra annual leave", tr: "Ek Yıllık İzin", group: "time" },
  { key: "BIRTHDAY_LEAVE", en: "Birthday leave", tr: "Doğum Günü İzni", group: "time" },
  { key: "HALF_DAY_FRIDAY", en: "Half-day Fridays", tr: "Cuma Yarım Gün", group: "time" },
  { key: "PARENTAL_LEAVE", en: "Extended parental leave", tr: "Uzatılmış Doğum İzni", group: "time" },
  // Way of working
  { key: "REMOTE_WORK", en: "Remote work", tr: "Uzaktan Çalışma", group: "work" },
  { key: "HYBRID_WORK", en: "Hybrid work", tr: "Hibrit Çalışma", group: "work" },
  { key: "FLEXIBLE_HOURS", en: "Flexible hours", tr: "Esnek Çalışma Saatleri", group: "work" },
  { key: "HOME_OFFICE_ALLOWANCE", en: "Home office allowance", tr: "Ev Ofis Desteği", group: "work" },
  { key: "COMPANY_PHONE", en: "Company phone", tr: "Şirket Telefonu", group: "work" },
  { key: "COMPANY_LAPTOP", en: "Company laptop", tr: "Şirket Bilgisayarı", group: "work" },
  { key: "WORK_CLOTHES", en: "Work clothes provided", tr: "İş Kıyafeti", group: "work" },
  { key: "ACCOMMODATION", en: "Accommodation", tr: "Lojman", group: "work" },
  { key: "UNION_AGREEMENT", en: "Collective agreement (union)", tr: "Toplu İş Sözleşmesi", group: "work" },
  // Growth
  { key: "TRAINING", en: "Training and courses", tr: "Eğitim Desteği", group: "growth" },
  { key: "LANGUAGE_COURSES", en: "Language courses", tr: "Yabancı Dil Eğitimi", group: "growth" },
  { key: "CERTIFICATION", en: "Certification support", tr: "Sertifika Desteği", group: "growth" },
  { key: "MASTERS_SUPPORT", en: "Master's degree support", tr: "Yüksek Lisans Desteği", group: "growth" },
  { key: "MENTORING", en: "Mentoring programme", tr: "Mentorluk Programı", group: "growth" },
  // Family
  { key: "KINDERGARTEN", en: "Nursery support", tr: "Kreş Desteği", group: "family" },
  { key: "CHILD_ALLOWANCE", en: "Child allowance", tr: "Çocuk Yardımı", group: "family" },
  { key: "SCHOOL_ALLOWANCE", en: "School support for children", tr: "Çocuk Eğitim Yardımı", group: "family" },
  { key: "MARRIAGE_BIRTH_SUPPORT", en: "Marriage and birth support", tr: "Evlilik ve Doğum Yardımı", group: "family" },
  // Workplace
  { key: "TEAM_EVENTS", en: "Team events", tr: "Sosyal Etkinlikler", group: "workplace" },
  { key: "GAME_ROOM", en: "Game and rest room", tr: "Oyun ve Dinlenme Alanı", group: "workplace" },
  { key: "PRAYER_ROOM", en: "Prayer room", tr: "Mescit", group: "workplace" },
  { key: "PET_FRIENDLY", en: "Pet-friendly office", tr: "Evcil Hayvan Dostu Ofis", group: "workplace" },
  { key: "ACCESSIBLE_WORKPLACE", en: "Accessible workplace", tr: "Engelli Dostu İşyeri", group: "workplace" },
] as const satisfies readonly PerkDefinition[];

export type PerkKey = (typeof PERK_CATALOG)[number]["key"];

export const PERK_KEYS = PERK_CATALOG.map((p) => p.key) as [PerkKey, ...PerkKey[]];
export const perkKeySchema = z.enum(PERK_KEYS);

// A company can list at most this many.
export const MAX_COMPANY_PERKS = 20;

export const companyPerksSchema = z
  .array(perkKeySchema)
  .max(MAX_COMPANY_PERKS, `Pick at most ${MAX_COMPANY_PERKS} perks`)
  .refine((v) => new Set(v).size === v.length, "Each perk can be picked once");

const PERK_BY_KEY = new Map<string, PerkDefinition>(PERK_CATALOG.map((p) => [p.key, p]));

export function perkDefinition(key: string): PerkDefinition | undefined {
  return PERK_BY_KEY.get(key);
}

// Keeps only keys still in the catalogue, in catalogue order (so a company's
// perks always read in the same, grouped order).
export function normalizePerks(keys: readonly string[]): PerkKey[] {
  const wanted = new Set(keys);
  return PERK_CATALOG.filter((p) => wanted.has(p.key)).map((p) => p.key);
}

// Folds Turkish letters so "yemek karti" finds "Yemek Kartı" and "is kiyafeti"
// finds "İş Kıyafeti".
export function foldForSearch(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/â/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// The suggestions for what an owner has typed so far: perks whose English or
// Turkish name has a word starting with it (then any containing it), not
// already picked. Both languages are searched, whichever one the page shows.
export function searchPerks(query: string, exclude: readonly string[] = [], limit = 8): PerkDefinition[] {
  const q = foldForSearch(query.trim());
  if (!q) return [];
  const skip = new Set(exclude);
  const starts: PerkDefinition[] = [];
  const contains: PerkDefinition[] = [];
  for (const p of PERK_CATALOG) {
    if (skip.has(p.key)) continue;
    const names = [foldForSearch(p.tr), foldForSearch(p.en)];
    if (names.some((n) => n.startsWith(q) || n.split(/[\s()/-]+/).some((w) => w.startsWith(q)))) starts.push(p);
    else if (names.some((n) => n.includes(q))) contains.push(p);
  }
  return [...starts, ...contains].slice(0, limit);
}
