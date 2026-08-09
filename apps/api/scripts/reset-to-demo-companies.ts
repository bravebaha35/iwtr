// Wipes every company currently in the directory (the Istanbul OSM pilot
// batch from scripts/seed-istanbul-companies.ts, or whatever real data has
// accumulated since) and replaces it with a small fixed set of obviously-
// fictional demo companies, so the browse/detail/rate UI has something to
// render while the frontend is still being designed. Real province-by-
// province seeding resumes later per apps/api/scripts/TURKEY-SEEDING-PLAYBOOK.md
// — this is a reset button for design work in between, not part of that
// pipeline.
//
// Deletes child rows before Company itself, same dependency order as
// cleanup-public-entities.ts. Then creates the demo set through the real
// CompaniesService.createByAdmin, so slug generation and the free-typed-
// employment-history backfill behave exactly as they do from the admin UI.
//
// Run from apps/api: pnpm exec ts-node scripts/reset-to-demo-companies.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import type { AdminCreateCompanyInput } from "@iwtr/shared-types";
import { PrismaService } from "../src/prisma/prisma.service";
import { CompaniesService } from "../src/modules/companies/companies.service";

const ADMIN_EMAIL = "cuneytbahasulunoglu@gmail.com";

// Clearly fictional (no real employer names), but realistic enough to exercise
// every workplaceType, a spread of categories, and both "has a city/district"
// and "remote, no location" rendering paths in the browse UI.
const DEMO_COMPANIES: AdminCreateCompanyInput[] = [
  { name: "Demo Teknoloji A.Ş.", category: "IT", workplaceType: "OFFICE", city: "İstanbul", district: "Kadıköy" },
  { name: "Örnek Kargo ve Lojistik", category: "Logistics", workplaceType: "MANUAL_LABOUR", city: "İstanbul", district: "Ümraniye" },
  { name: "Test Cafe & Restoran", category: "Food & Beverage", workplaceType: "SERVICE", city: "Ankara", district: "Çankaya" },
  { name: "Placeholder Danışmanlık", category: "Consulting", workplaceType: "HYBRID_REMOTE" },
  { name: "Numune İnşaat", category: "Construction", workplaceType: "MANUAL_LABOUR", city: "İzmir", district: "Konak" },
  { name: "Demo Finans Holding", category: "Finance", workplaceType: "OFFICE", city: "İstanbul", district: "Şişli" },
  { name: "Örnek Perakende Mağazacılık", category: "Retail", workplaceType: "SERVICE", city: "Bursa", district: "Nilüfer" },
  { name: "Test Yazılım Stüdyosu", category: "Software", workplaceType: "HYBRID_REMOTE" },
  { name: "Placeholder Sağlık Hizmetleri", category: "Healthcare", workplaceType: "OFFICE", city: "İstanbul", district: "Beşiktaş" },
  { name: "Numune Eğitim Kurumları", category: "Education", workplaceType: "OFFICE", city: "Ankara", district: "Yenimahalle" },
];

async function main() {
  const prisma = new PrismaClient();

  const existing = await prisma.company.count();
  console.log(`Deleting ${existing} existing companies and their dependent rows...`);

  const deletion = await prisma.$transaction(async (tx) => {
    return {
      reviewVotes: (await tx.reviewVote.deleteMany({})).count,
      moderationQueueItems: (await tx.moderationQueueItem.deleteMany({})).count,
      reviews: (await tx.review.deleteMany({})).count,
      companyOwners: (await tx.companyOwner.deleteMany({})).count,
      ownerContactMessages: (await tx.ownerContactMessage.deleteMany({})).count,
      companyAggregateScores: (await tx.companyAggregateScore.deleteMany({})).count,
      employmentHistoriesUnlinked: (
        await tx.employmentHistory.updateMany({ where: { companyId: { not: null } }, data: { companyId: null } })
      ).count,
      companies: (await tx.company.deleteMany({})).count,
    };
  });
  console.log("Deletion summary:", deletion);

  await prisma.$disconnect();

  console.log(`\nCreating ${DEMO_COMPANIES.length} demo companies...`);
  const prismaService = new PrismaService();
  await prismaService.$connect();
  const companiesService = new CompaniesService(prismaService);

  const admin = await prismaService.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    throw new Error(`Admin user not found: ${ADMIN_EMAIL}`);
  }

  let created = 0;
  for (const c of DEMO_COMPANIES) {
    await companiesService.createByAdmin(admin.id, c);
    created++;
    console.log(`  Created: ${c.name}`);
  }

  console.log(`\nDone. Created ${created} demo companies.`);
  await prismaService.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
