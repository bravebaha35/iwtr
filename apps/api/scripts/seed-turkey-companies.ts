// Nationwide company-directory seeder — generalizes the validated Istanbul
// pilot (seed-istanbul-companies.ts, TR-34 only) into a per-province loop
// covering all 81 provinces, per apps/api/scripts/TURKEY-SEEDING-PLAYBOOK.md's
// "natural next step" note. Defaults to the 8-province Aegean region (Ege
// Bölgesi) since that's the initial launch focus; pass --all or --provinces
// to cover others.
//
// Reuses TURKEY_PROVINCES/findDistrictInProvince from
// packages/shared-types/src/geo/turkey.ts (the same single source of truth
// CompaniesService.createByAdmin/search already validate against) instead of
// a hardcoded per-province district list. Also reuses — by importing, not
// duplicating — two pieces of logic the playbook calls out as their own
// scripts:
//   - `classify` from cleanup-public-entities.ts (the government/notary/
//     political-party/public-school/public-hospital keyword classifier),
//     applied inline to skip public entities before they're ever inserted,
//     rather than seeding them and deleting them in a separate pass.
//   - `normalizeName` from normalize-company-names.ts (Turkish diacritic
//     restoration + Title Case), applied to each candidate's name before
//     insertion, rather than normalizing the whole table after the fact.
// Both source files guard their own DB-scanning main() behind
// `require.main === module` specifically so importing these functions here
// doesn't also trigger their standalone behavior.
//
// Deliberately collects ONLY name + category + workplaceType + city/district
// — same scope decision as seed-istanbul-companies.ts (no address/phone/
// email/lat-lng; see that script's and the playbook's "what this deliberately
// does NOT do" notes).
//
// Run from apps/api:
//   pnpm exec ts-node scripts/seed-turkey-companies.ts --list-provinces
//   pnpm exec ts-node scripts/seed-turkey-companies.ts                    (Aegean region, default)
//   pnpm exec ts-node scripts/seed-turkey-companies.ts --provinces=34,06
//   pnpm exec ts-node scripts/seed-turkey-companies.ts --all

import "dotenv/config";
import { ConflictException } from "@nestjs/common";
import type { WorkplaceType } from "@iwtr/shared-types";
import { TURKEY_PROVINCES, findDistrictInProvince, type TurkeyProvince } from "@iwtr/shared-types";
import { PrismaService } from "../src/prisma/prisma.service";
import { CompaniesService } from "../src/modules/companies/companies.service";
import { classifyWorkplace, inferCompanyWorkplaceTypes } from "../src/modules/companies/workplace-classifier/classifyJobRole";
import { classify as classifyPublicEntity } from "./cleanup-public-entities";
import { normalizeName } from "./normalize-company-names";

const ADMIN_EMAIL = "cuneytbahasulunoglu@gmail.com";
const BATCH_SIZE = 500;

// Ege Bölgesi (Aegean region) — the 8 provinces given launch priority.
// Plate codes double as the ISO 3166-2 "TR-XX" suffix Overpass needs, and as
// TurkeyProvince.plate, so no separate code table is needed.
const AEGEAN_PLATES = ["03", "09", "20", "35", "43", "45", "48", "64"];

// Same ASCII-fold approach as shared-types/geo/turkey.ts's normalizeCityName
// and every other seeding/normalization script in this directory.
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

function matchDistrict(province: TurkeyProvince, candidates: (string | undefined)[]): string | null {
  for (const raw of candidates) {
    if (!raw) continue;
    // OSM sometimes writes "Kadıköy/İstanbul" or "Kadıköy, İstanbul".
    const first = raw.split(/[/,]/)[0].trim();
    const match = findDistrictInProvince(province, first);
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

// Same Unicode-letter boundary as moderation.service.ts's matchesAsWord and
// cleanup-public-entities.ts's matchesKeyword — plain \b can't match before
// Turkish-specific capitals (Ç/Ğ/İ/Ö/Ş/Ü).
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
// directly — checked before the single-type name-based classification below.
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
// can only ever produce OFFICE or MANUAL_LABOUR. Run the business's name
// (plus this tag-based guess, as extra context) through the Turkish keyword
// classifier first; only fall back to the coarser tag split when the
// classifier finds no real keyword match.
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

interface ProvinceStats {
  province: string;
  fetched: number;
  noName: number;
  closedByTag: number;
  closedByName: number;
  personalName: number;
  publicEntity: number;
  noDistrictMatch: number;
  duplicateInBatch: number;
  candidates: number;
  imported: number;
  skippedDuplicateName: number;
  failed: number;
}

// Fetches, filters, and imports one province — the per-province unit the
// playbook explicitly calls for instead of one nationwide Overpass query
// ("Overpass's public instance actively discourages exactly that").
async function seedProvince(
  province: TurkeyProvince,
  companiesService: CompaniesService,
  adminUserId: string,
): Promise<ProvinceStats> {
  const isoCode = `TR-${province.plate}`;
  console.log(`\n=== ${province.name} (${isoCode}) ===`);
  console.log(`Fetching named office/craft entities from Overpass...`);

  const query = `
    [out:json][timeout:180];
    area["ISO3166-2"="${isoCode}"]->.a;
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

  const stats: ProvinceStats = {
    province: province.name,
    fetched: elements.length,
    noName: 0,
    closedByTag: 0,
    closedByName: 0,
    personalName: 0,
    publicEntity: 0,
    noDistrictMatch: 0,
    duplicateInBatch: 0,
    candidates: 0,
    imported: 0,
    skippedDuplicateName: 0,
    failed: 0,
  };

  const seenNames = new Set<string>();
  const candidates: Candidate[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const rawName = tags.name?.trim();
    if (!rawName) {
      stats.noName++;
      continue;
    }
    if (isClosedByTags(tags)) {
      stats.closedByTag++;
      continue;
    }
    if (isClosedByName(rawName)) {
      stats.closedByName++;
      continue;
    }
    if (looksLikePersonalName(rawName)) {
      stats.personalName++;
      continue;
    }

    // Normalize (deasciify + Title Case) before the public-entity check —
    // the classifier's keyword list is written in proper Turkish casing
    // ("Belediyesi", "Müdürlüğü"), and OSM names are frequently ALL CAPS or
    // ASCII-flattened, which word-boundary matching still catches either way
    // but running the real, already-shipped normalizer first keeps this
    // script's insert-time name identical to what a post-hoc pass would have
    // produced anyway.
    const name = normalizeName(rawName);

    if (classifyPublicEntity(name).action === "delete") {
      stats.publicEntity++;
      continue;
    }

    const district = matchDistrict(province, [tags["addr:district"], tags["addr:suburb"], tags["is_in:district"], tags["addr:city"]]);
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

  console.log(`Filter summary for ${province.name}:`, stats);

  const perDistrict = new Map<string, number>();
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    for (const c of batch) {
      try {
        await companiesService.createByAdmin(adminUserId, {
          name: c.name,
          category: c.category,
          workplaceTypes: c.workplaceTypes,
          city: province.name,
          district: c.district,
        });
        stats.imported++;
        perDistrict.set(c.district, (perDistrict.get(c.district) ?? 0) + 1);
      } catch (err) {
        if (err instanceof ConflictException) {
          stats.skippedDuplicateName++;
        } else {
          stats.failed++;
          console.error(`Failed to import "${c.name}":`, err instanceof Error ? err.message : err);
        }
      }
    }
    console.log(`  ${province.name}: processed ${Math.min(i + BATCH_SIZE, candidates.length)}/${candidates.length}...`);
  }

  console.log(`--- ${province.name} import summary ---`);
  console.log("  Imported:                    ", stats.imported);
  console.log("  Skipped, name already in DB: ", stats.skippedDuplicateName);
  console.log("  Rejected, public entity:     ", stats.publicEntity);
  console.log("  Failed, other error:         ", stats.failed);
  for (const [district, count] of [...perDistrict.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${district}: ${count}`);
  }

  return stats;
}

interface CliOptions {
  provinces: TurkeyProvince[];
  listOnly: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const listOnly = argv.includes("--list-provinces");

  if (argv.includes("--all")) {
    return { provinces: TURKEY_PROVINCES, listOnly };
  }

  const provincesArg = argv.find((a) => a.startsWith("--provinces="));
  if (provincesArg) {
    const plates = new Set(provincesArg.slice("--provinces=".length).split(",").map((p) => p.trim().padStart(2, "0")));
    const resolved = TURKEY_PROVINCES.filter((p) => plates.has(p.plate));
    const unresolved = [...plates].filter((plate) => !resolved.some((p) => p.plate === plate));
    if (unresolved.length > 0) {
      throw new Error(`Unknown province plate code(s): ${unresolved.join(", ")}`);
    }
    return { provinces: resolved, listOnly };
  }

  // Default: Aegean region — this launch's initial focus.
  const aegean = TURKEY_PROVINCES.filter((p) => AEGEAN_PLATES.includes(p.plate));
  return { provinces: aegean, listOnly };
}

async function main() {
  const { provinces, listOnly } = parseArgs(process.argv.slice(2));

  console.log(`Resolved ${provinces.length} province(s):`);
  for (const p of provinces) {
    console.log(`  TR-${p.plate}  ${p.name}  (${p.districts.length} districts)`);
  }

  if (listOnly) {
    return;
  }

  const prisma = new PrismaService();
  await prisma.$connect();
  const companiesService = new CompaniesService(prisma);

  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    await prisma.$disconnect();
    throw new Error(`Admin user not found: ${ADMIN_EMAIL}`);
  }

  const allStats: ProvinceStats[] = [];
  for (const province of provinces) {
    const stats = await seedProvince(province, companiesService, admin.id);
    allStats.push(stats);
  }

  console.log("\n\n=== NATIONWIDE IMPORT SUMMARY ===");
  const totals = allStats.reduce(
    (acc, s) => ({
      fetched: acc.fetched + s.fetched,
      candidates: acc.candidates + s.candidates,
      imported: acc.imported + s.imported,
      publicEntity: acc.publicEntity + s.publicEntity,
      skippedDuplicateName: acc.skippedDuplicateName + s.skippedDuplicateName,
      failed: acc.failed + s.failed,
    }),
    { fetched: 0, candidates: 0, imported: 0, publicEntity: 0, skippedDuplicateName: 0, failed: 0 },
  );
  console.log("Provinces processed:          ", allStats.length);
  console.log("OSM elements fetched (total): ", totals.fetched);
  console.log("Candidates after filtering:   ", totals.candidates);
  console.log("Rejected, public entity:      ", totals.publicEntity);
  console.log("Imported (total):             ", totals.imported);
  console.log("Skipped, name already in DB:  ", totals.skippedDuplicateName);
  console.log("Failed, other error:          ", totals.failed);
  console.log("");
  for (const s of allStats) {
    console.log(`  ${s.province}: imported ${s.imported} / candidates ${s.candidates} / fetched ${s.fetched}`);
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
