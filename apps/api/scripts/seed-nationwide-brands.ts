// Seeds the specific CITY_BASED and REGION_BASED "Master Parent" nationwide
// brands given in the 2026-09 dual-structure spec — one Company row per
// verified real branch location (a city for CITY_BASED brands, a region for
// REGION_BASED ones), named "<Brand> <City> Şubeleri" / "<Brand> <Region>
// Bölgesi Şubeleri". Branch existence comes from MockBranchPresenceProvider
// (apps/api/src/modules/companies/branch-presence.provider.ts) so a brand
// with no real presence in a province never gets a dead page — see that
// file's doc comment for how to swap in a real locator API later.
//
// Safe to re-run: CompaniesService.createByAdmin already rejects a
// duplicate name with ConflictException, which this script catches and
// counts as "skipped", same pattern as seed-turkey-companies.ts.
//
// Run from apps/api: pnpm exec ts-node scripts/seed-nationwide-brands.ts

import "dotenv/config";
import { ConflictException } from "@nestjs/common";
import { regionLabel, type TurkeyRegionKey, type WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../src/prisma/prisma.service";
import { CompaniesService } from "../src/modules/companies/companies.service";
import { MockBranchPresenceProvider } from "../src/modules/companies/branch-presence.provider";

const ADMIN_EMAIL = "cuneytbahasulunoglu@gmail.com";

interface BrandDef {
  name: string;
  category: string;
  workplaceTypes: WorkplaceType[];
  mode: "CITY" | "REGION";
}

// category strings are deliberately exact matches for the browse-page filter
// buttons (Supermarket/Franchise/Logistics) added alongside this feature —
// see apps/web/src/components/WorkplaceBrowser.tsx's CATEGORY_FILTERS.
const BRANDS: BrandDef[] = [
  // --- City-based ---
  { name: "Yurtiçi Kargo", category: "Logistics", workplaceTypes: ["MANUAL_LABOUR"], mode: "CITY" },
  { name: "Aras Kargo", category: "Logistics", workplaceTypes: ["MANUAL_LABOUR"], mode: "CITY" },
  { name: "DHL Kargo", category: "Logistics", workplaceTypes: ["MANUAL_LABOUR"], mode: "CITY" },
  { name: "Trendyol Express", category: "Logistics", workplaceTypes: ["MANUAL_LABOUR"], mode: "CITY" },
  { name: "HepsiJet", category: "Logistics", workplaceTypes: ["MANUAL_LABOUR"], mode: "CITY" },
  { name: "A101", category: "Supermarket", workplaceTypes: ["SERVICE"], mode: "CITY" },
  { name: "BİM", category: "Supermarket", workplaceTypes: ["SERVICE"], mode: "CITY" },
  { name: "ŞOK Market", category: "Supermarket", workplaceTypes: ["SERVICE"], mode: "CITY" },
  { name: "Migros", category: "Supermarket", workplaceTypes: ["SERVICE"], mode: "CITY" },
  { name: "Tarım Kredi Kooperatif Market", category: "Supermarket", workplaceTypes: ["SERVICE"], mode: "CITY" },
  { name: "Türk Telekom", category: "Telecom", workplaceTypes: ["SERVICE"], mode: "CITY" },
  { name: "Turkcell Superonline", category: "Telecom", workplaceTypes: ["SERVICE"], mode: "CITY" },
  { name: "Vodafone", category: "Telecom", workplaceTypes: ["SERVICE"], mode: "CITY" },
  { name: "LC Waikiki", category: "Clothing Retail", workplaceTypes: ["SERVICE"], mode: "CITY" },
  { name: "DeFacto", category: "Clothing Retail", workplaceTypes: ["SERVICE"], mode: "CITY" },
  { name: "Koton", category: "Clothing Retail", workplaceTypes: ["SERVICE"], mode: "CITY" },
  { name: "Starbucks", category: "Franchise", workplaceTypes: ["SERVICE"], mode: "CITY" },
  { name: "Burger King", category: "Franchise", workplaceTypes: ["SERVICE"], mode: "CITY" },
  // --- Region-based ---
  { name: "Sendeo", category: "Logistics", workplaceTypes: ["MANUAL_LABOUR"], mode: "REGION" },
  { name: "Kolay Gelsin", category: "Logistics", workplaceTypes: ["MANUAL_LABOUR"], mode: "REGION" },
  { name: "UPS Kargo", category: "Logistics", workplaceTypes: ["MANUAL_LABOUR"], mode: "REGION" },
  { name: "Seç Market", category: "Supermarket", workplaceTypes: ["SERVICE"], mode: "REGION" },
  { name: "TurkNet", category: "Telecom", workplaceTypes: ["SERVICE"], mode: "REGION" },
  { name: "TotalEnergies", category: "Fuel & Energy", workplaceTypes: ["SERVICE"], mode: "REGION" },
  { name: "Petrol Ofisi", category: "Fuel & Energy", workplaceTypes: ["SERVICE"], mode: "REGION" },
  { name: "Opet", category: "Fuel & Energy", workplaceTypes: ["SERVICE"], mode: "REGION" },
  { name: "Shell", category: "Fuel & Energy", workplaceTypes: ["SERVICE"], mode: "REGION" },
  { name: "Türkiye Petrolleri", category: "Fuel & Energy", workplaceTypes: ["SERVICE"], mode: "REGION" },
];

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const companies = new CompaniesService(prisma);
  const branchPresence = new MockBranchPresenceProvider();

  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    await prisma.$disconnect();
    throw new Error(`Admin user not found: ${ADMIN_EMAIL}`);
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const brand of BRANDS) {
    const locations: { name: string; city?: string; region?: TurkeyRegionKey }[] =
      brand.mode === "CITY"
        ? branchPresence.getCityPresence(brand.name).map((city) => ({ name: `${brand.name} ${city} Şubeleri`, city }))
        : branchPresence
            .getRegionPresence(brand.name)
            .map((region) => ({ name: `${brand.name} ${regionLabel(region)} Bölgesi Şubeleri`, region }));

    if (locations.length === 0) {
      console.warn(`No verified branch presence for "${brand.name}" — skipping entirely.`);
      continue;
    }

    for (const loc of locations) {
      try {
        await companies.createByAdmin(admin.id, {
          name: loc.name,
          category: brand.category,
          workplaceTypes: brand.workplaceTypes,
          structureType: brand.mode === "CITY" ? "CITY_BASED" : "REGION_BASED",
          city: loc.city,
          region: loc.region,
        });
        created++;
      } catch (err) {
        if (err instanceof ConflictException) {
          skipped++;
        } else {
          failed++;
          console.error(`Failed to create "${loc.name}":`, err instanceof Error ? err.message : err);
        }
      }
    }
    console.log(`${brand.name}: ${locations.length} location(s) processed.`);
  }

  console.log(`Done. Created ${created}, skipped ${skipped} (already existed), failed ${failed}.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
