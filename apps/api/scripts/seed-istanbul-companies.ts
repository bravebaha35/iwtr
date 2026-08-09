// One-off pilot seeder: pulls named office/craft entities in Istanbul from
// OpenStreetMap (Overpass API), filters out closed/liquidated businesses and
// bare personal names, matches each result's district against our own
// Istanbul district list (apps/web/src/lib/turkeyGeo.ts), and creates them
// through the real CompaniesService.createByAdmin — same name-uniqueness,
// slug generation, and employment-history backfill as the admin UI uses, no
// raw-table shortcuts.
//
// Deliberately collects ONLY name + category + workplaceType + city/district.
// Company has no address/phone/email/lat-lng columns today (that would be a
// schema change), and this platform doesn't use precise addresses anywhere —
// see the "distance sort" comment in turkeyGeo.ts. Scraping and storing real
// businesses' phone/email at scale is also a KVKK question no keyword filter
// can settle, so it's out of scope here entirely.
//
// Run from apps/api: pnpm exec ts-node scripts/seed-istanbul-companies.ts

import "dotenv/config";
import { ConflictException } from "@nestjs/common";
import type { WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../src/prisma/prisma.service";
import { CompaniesService } from "../src/modules/companies/companies.service";
import { classifyWorkplace, inferCompanyWorkplaceTypes } from "../src/modules/companies/workplace-classifier/classifyJobRole";

const ADMIN_EMAIL = "cuneytbahasulunoglu@gmail.com";
const PROVINCE_ISO = "TR-34";
const PROVINCE_NAME = "İstanbul";
const BATCH_SIZE = 500;

// Copied from apps/web/src/lib/turkeyGeo.ts's İstanbul entry — keep in sync
// if that list ever changes, or if this script grows to cover more provinces.
const ISTANBUL_DISTRICTS = [
  "Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir",
  "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy",
  "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane",
  "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer", "Silivri", "Sultanbeyli",
  "Sultangazi", "Şile", "Şişli", "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu",
];

// Same ASCII-fold approach as apps/web/src/lib/turkeyGeo.ts's normalizeCityName.
function normalizeTr(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

const DISTRICT_BY_NORMALIZED = new Map(ISTANBUL_DISTRICTS.map((d) => [normalizeTr(d), d]));

function matchDistrict(candidates: (string | undefined)[]): string | null {
  for (const raw of candidates) {
    if (!raw) continue;
    // OSM sometimes writes "Kadıköy/İstanbul" or "Kadıköy, İstanbul".
    const first = raw.split(/[/,]/)[0].trim();
    const match = DISTRICT_BY_NORMALIZED.get(normalizeTr(first));
    if (match) return match;
  }
  return null;
}

const CLOSED_NAME_KEYWORDS = [
  "tasfiye halinde", "iflas", "feshedilmis", "munfesih", "kapandi", "kapatildi",
].map(normalizeTr);

function isClosedByName(name: string): boolean {
  const normalized = normalizeTr(name);
  return CLOSED_NAME_KEYWORDS.some((k) => normalized.includes(k));
}

function isClosedByTags(tags: Record<string, string>): boolean {
  if (tags.disused || tags.abandoned) return true;
  if (tags.shop === "vacant") return true;
  if (tags.office === "no") return true;
  if (tags.opening_hours && normalizeTr(tags.opening_hours).includes("closed")) return true;
  return Object.keys(tags).some((k) => k.startsWith("disused:") || k.startsWith("abandoned:"));
}

const CORPORATE_MARKERS = [
  "a.s", "as", "ltd", "sti", "holding", "anonim sirketi", "limited sirketi", "sanayi", "ticaret", "grup", "group", "co.", "corp",
].map(normalizeTr);

// Same Unicode-letter boundary as moderation.service.ts's matchesAsWord/
// NAME_LIKE_PATTERN fix — plain \b can't match before Turkish-specific
// capitals (Ç/Ğ/İ/Ö/Ş/Ü), so this checks the whole string is exactly two
// capitalized words with no corporate suffix — i.e. looks like a person.
const PLAIN_PERSON_NAME = /^(?<![\p{L}\p{N}])[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?![\p{L}\p{N}])$/u;

function looksLikePersonalName(name: string): boolean {
  const trimmed = name.trim();
  const normalized = normalizeTr(trimmed);
  if (CORPORATE_MARKERS.some((m) => normalized.includes(m))) return false;
  return PLAIN_PERSON_NAME.test(trimmed);
}

function titleCase(value: string): string {
  return value.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const OFFICE_CATEGORY_LABELS: Record<string, string> = {
  it: "IT",
  lawyer: "Legal",
  accountant: "Accounting",
  insurance: "Insurance",
  finance: "Finance",
  government: "Government",
  ngo: "NGO",
  company: "Professional Services",
  logistics: "Logistics",
  educational_institution: "Education",
  architect: "Architecture",
  advertising_agency: "Advertising",
  estate_agent: "Real Estate",
  employment_agency: "Recruitment",
  telecommunication: "Telecommunications",
  engineer: "Engineering",
  construction_company: "Construction",
  travel_agent: "Travel",
  physician: "Healthcare",
  therapist: "Healthcare",
  political_party: "Government",
  association: "NGO",
  research: "Research",
  newspaper: "Media",
  publisher: "Media",
  diplomatic: "Government",
  water_utility: "Utilities",
  energy_supplier: "Utilities",
  moving_company: "Logistics",
  security: "Security",
};

// A hospital/healthcare or industrial/factory OSM tag is a strong enough
// signal to apply inferCompanyWorkplaceTypes's 2-tag sector override
// directly (e.g. a hospital is genuinely SERVICE + OFFICE, not just
// whichever single type its name happens to contain a keyword for) —
// checked before the single-type name-based classification below.
function sectorOverrideFromTags(tags: Record<string, string>): WorkplaceType[] | null {
  if (tags.amenity === "hospital" || tags.healthcare) {
    return inferCompanyWorkplaceTypes("Hastane / Sağlık");
  }
  if (tags.building === "industrial" || tags.man_made === "works") {
    return inferCompanyWorkplaceTypes("Üretim / Fabrika");
  }
  return null;
}

// OSM only ever tags an entity as "office" or "craft" — a binary split that
// can only ever produce OFFICE or MANUAL_LABOUR, never SERVICE or
// HYBRID_REMOTE, and says nothing about which specific sector. Run the
// business's name (and this tag-based guess, as extra context) through the
// Turkish keyword classifier first; only fall back to the coarser tag split
// when the classifier finds no real keyword match (confidenceScore === 0) —
// most OSM entries' names won't contain one of our specific job-title
// phrases, and in that case the tag-based guess is still a better prior than
// an arbitrary fallback.
function categoryAndWorkplaceTypes(name: string, tags: Record<string, string>): { category: string; workplaceTypes: WorkplaceType[] } {
  const tagBased: { category: string; workplaceType: WorkplaceType } = tags.office
    ? { category: OFFICE_CATEGORY_LABELS[tags.office] ?? titleCase(tags.office.replace(/_/g, " ")), workplaceType: "OFFICE" }
    : { category: titleCase((tags.craft ?? "general").replace(/_/g, " ")), workplaceType: "MANUAL_LABOUR" };

  const sectorOverride = sectorOverrideFromTags(tags);
  if (sectorOverride) {
    return { category: tagBased.category, workplaceTypes: sectorOverride };
  }

  const classified = classifyWorkplace(name, tagBased.category);
  if (classified.confidenceScore > 0) {
    return { category: classified.matchedSector, workplaceTypes: [classified.workplaceType] };
  }
  return { category: tagBased.category, workplaceTypes: [tagBased.workplaceType] };
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
}

async function fetchOverpass(query: string): Promise<OverpassElement[]> {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "*/*",
      "User-Agent": "curl/8.0",
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    throw new Error(`Overpass request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { elements: OverpassElement[] };
  return json.elements;
}

interface Candidate {
  name: string;
  category: string;
  workplaceTypes: WorkplaceType[];
  district: string;
}

async function main() {
  console.log(`Fetching named office/craft entities in Istanbul (${PROVINCE_ISO}) from Overpass...`);
  const query = `
    [out:json][timeout:180];
    area["ISO3166-2"="${PROVINCE_ISO}"]->.a;
    (
      node["office"]["name"](area.a);
      way["office"]["name"](area.a);
      node["craft"]["name"](area.a);
      way["craft"]["name"](area.a);
    );
    out tags;
  `;
  const elements = await fetchOverpass(query);
  console.log(`Fetched ${elements.length} raw elements from OSM.`);

  const stats = {
    fetched: elements.length,
    noName: 0,
    closedByTag: 0,
    closedByName: 0,
    personalName: 0,
    noDistrictMatch: 0,
    duplicateInBatch: 0,
    candidates: 0,
  };

  const seenNames = new Set<string>();
  const candidates: Candidate[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags.name?.trim();
    if (!name) {
      stats.noName++;
      continue;
    }
    if (isClosedByTags(tags)) {
      stats.closedByTag++;
      continue;
    }
    if (isClosedByName(name)) {
      stats.closedByName++;
      continue;
    }
    if (looksLikePersonalName(name)) {
      stats.personalName++;
      continue;
    }

    const district = matchDistrict([tags["addr:district"], tags["addr:suburb"], tags["is_in:district"], tags["addr:city"]]);
    if (!district) {
      stats.noDistrictMatch++;
      continue;
    }

    const key = normalizeTr(name);
    if (seenNames.has(key)) {
      stats.duplicateInBatch++;
      continue;
    }
    seenNames.add(key);

    const { category, workplaceTypes } = categoryAndWorkplaceTypes(name, tags);
    candidates.push({ name, category, workplaceTypes, district });
    stats.candidates++;
  }

  console.log("Filter summary:", stats);

  const prisma = new PrismaService();
  await prisma.$connect();
  const companiesService = new CompaniesService(prisma);

  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    throw new Error(`Admin user not found: ${ADMIN_EMAIL}`);
  }

  let imported = 0;
  let skippedDuplicateName = 0;
  let failed = 0;
  const perDistrict = new Map<string, number>();

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    for (const c of batch) {
      try {
        await companiesService.createByAdmin(admin.id, {
          name: c.name,
          category: c.category,
          workplaceTypes: c.workplaceTypes,
          city: PROVINCE_NAME,
          district: c.district,
        });
        imported++;
        perDistrict.set(c.district, (perDistrict.get(c.district) ?? 0) + 1);
      } catch (err) {
        if (err instanceof ConflictException) {
          skippedDuplicateName++;
        } else {
          failed++;
          console.error(`Failed to import "${c.name}":`, err instanceof Error ? err.message : err);
        }
      }
    }
    console.log(`Processed ${Math.min(i + BATCH_SIZE, candidates.length)}/${candidates.length}...`);
  }

  console.log("");
  console.log("--- IMPORT SUMMARY ---");
  console.log("OSM elements fetched:          ", stats.fetched);
  console.log("Rejected, no name:             ", stats.noName);
  console.log("Rejected, closed/disused tag:  ", stats.closedByTag);
  console.log("Rejected, closure keyword:     ", stats.closedByName);
  console.log("Rejected, looks like a person: ", stats.personalName);
  console.log("Rejected, no district match:   ", stats.noDistrictMatch);
  console.log("Rejected, duplicate in batch:  ", stats.duplicateInBatch);
  console.log("Candidates after filtering:    ", stats.candidates);
  console.log("Imported:                      ", imported);
  console.log("Skipped, name already in DB:   ", skippedDuplicateName);
  console.log("Failed, other error:           ", failed);
  console.log("");
  console.log("Breakdown by district:");
  for (const [district, count] of [...perDistrict.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${district}: ${count}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
