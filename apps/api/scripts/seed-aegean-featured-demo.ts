// NOTE (2026-10-18): job ads only show for a company with an approved owner
// (HIRING_COMPANY_WHERE in companies/company-visibility.ts). Ads this script
// writes onto an unclaimed company stay hidden until someone claims it.
// Dev-only: a few made-up hiring companies in the other Aegean provinces,
// each with two Featured (boosted) job ads, so the Jobs page's "fewer than
// 4 featured ads in the chosen city -> top up from the same region" rule
// can be seen on screen. Pick İzmir in the Location filter on /jobs: İzmir
// has one featured ad of its own, so the row fills up from Manisa, Aydın,
// Denizli, Muğla and Uşak.
//
// The featured row is picked from the member's own field first (profile
// Sector, else kind of work), and the top-up stays inside that field - so
// every company here has an Office ad next to its own kind of work, and an
// Office member sees the fill as well as a Manual-Labour or Service one.
//
// Safe to re-run: a company that already exists (by slug) is left alone,
// and its boost is simply renewed for another 14 days.
//
// Run from apps/api: pnpm exec ts-node --transpile-only scripts/seed-aegean-featured-demo.ts

import "dotenv/config";
import { PrismaClient, type WorkplaceType } from "@prisma/client";

const prisma = new PrismaClient();

const BOOST_DAYS = 14;

const DEMO: {
  slug: string;
  name: string;
  category: string;
  workType: WorkplaceType;
  city: string;
  district: string;
  jobTitle: string;
  perks: string;
  officeJobTitle: string;
}[] = [
  {
    slug: "ornek-ege-seramik",
    name: "Örnek Ege Seramik",
    category: "Manufacturing",
    workType: "MANUAL_LABOUR",
    city: "Manisa",
    district: "Yunusemre",
    jobTitle: "Üretim Operatörü",
    officeJobTitle: "Üretim Planlama Uzmanı",
    perks: "Shift work with a monthly rota. Meal card and company transport included.",
  },
  {
    slug: "numune-aydin-tarim",
    name: "Numune Aydın Tarım",
    category: "Agriculture",
    workType: "MANUAL_LABOUR",
    city: "Aydın",
    district: "Efeler",
    jobTitle: "Sera Çalışanı",
    officeJobTitle: "Muhasebe Uzmanı",
    perks: "Full-time, Monday to Saturday. Training provided, no experience needed.",
  },
  {
    slug: "demo-denizli-tekstil",
    name: "Demo Denizli Tekstil",
    category: "Textile",
    workType: "MANUAL_LABOUR",
    city: "Denizli",
    district: "Merkezefendi",
    jobTitle: "Kalite Kontrol Elemanı",
    officeJobTitle: "İhracat Uzmanı",
    perks: "Full-time, weekdays. Overtime paid at the legal rate.",
  },
  {
    slug: "test-mugla-otelcilik",
    name: "Test Muğla Otelcilik",
    category: "Tourism",
    workType: "SERVICE",
    city: "Muğla",
    district: "Bodrum",
    jobTitle: "Resepsiyonist",
    officeJobTitle: "Rezervasyon Uzmanı",
    perks: "Seasonal contract with staff housing. English is a plus.",
  },
  {
    slug: "placeholder-usak-lojistik",
    name: "Placeholder Uşak Lojistik",
    category: "Logistics",
    workType: "MANUAL_LABOUR",
    city: "Uşak",
    district: "Merkez",
    jobTitle: "Depo Sorumlusu",
    officeJobTitle: "Lojistik Planlama Uzmanı",
    perks: "Full-time, weekdays. Private health insurance after probation.",
  },
];

async function main() {
  const now = new Date();
  const boostExpiresAt = new Date(now.getTime() + BOOST_DAYS * 24 * 60 * 60 * 1000);

  for (const d of DEMO) {
    const company = await prisma.company.upsert({
      where: { slug: d.slug },
      update: { isHiring: true, workplaceTypes: [d.workType, "OFFICE"] },
      create: {
        slug: d.slug,
        name: d.name,
        category: d.category,
        workplaceTypes: [d.workType, "OFFICE"],
        city: d.city,
        district: d.district,
        isHiring: true,
        contactEmail: `kariyer@${d.slug}.example`,
      },
    });

    const boost = {
      boostDurationDays: BOOST_DAYS,
      boostIsFree: false,
      boostPaymentStatus: "PAID" as const,
      boostAdSpace: false,
      boostStartedAt: now,
      boostExpiresAt,
    };
    const ads: { jobTitle: string; workType: WorkplaceType; perks: string }[] = [
      { jobTitle: d.jobTitle, workType: d.workType, perks: d.perks },
      { jobTitle: d.officeJobTitle, workType: "OFFICE", perks: "Full-time, weekdays. Meal card included." },
    ];
    for (const ad of ads) {
      const existing = await prisma.jobPosting.findFirst({ where: { companyId: company.id, jobTitle: ad.jobTitle } });
      if (existing) {
        await prisma.jobPosting.update({ where: { id: existing.id }, data: { status: "PUBLISHED", createdAt: now, ...boost } });
      } else {
        await prisma.jobPosting.create({
          data: {
            companyId: company.id,
            jobTitle: ad.jobTitle,
            workType: ad.workType,
            description: `${ad.jobTitle} wanted in ${d.city}. ${ad.perks} Apply with your CV through I Worked There.`,
            status: "PUBLISHED",
            ...boost,
          },
        });
      }
    }
    console.log(
      `${d.name} (${d.district}, ${d.city}): "${d.jobTitle}" and "${d.officeJobTitle}" featured until ${boostExpiresAt.toISOString().slice(0, 10)}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
