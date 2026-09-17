// DB-backed mirror of apps/web/src/lib/sectors.ts's SECTORS constant —
// kept as a literal copy (not imported, since this script runs against
// apps/api and that file lives in apps/web) so the member-profile Sector
// picker offers the exact same curated taxonomy the company-side Sector
// filter already uses. Delete-all + re-insert on every run — this table is
// 100% authored reference content, never user data.
//
// Run from apps/api: pnpm exec ts-node scripts/seed-sectors.ts
import "dotenv/config";
import { PrismaClient, WorkplaceType } from "@prisma/client";

const prisma = new PrismaClient();

const SECTORS: { value: string; label: string; workplaceTypes: WorkplaceType[] }[] = [
  { value: "Advertising & Marketing", label: "Advertising & Marketing", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Agriculture", label: "Agriculture", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Archive Management & Storage", label: "Archive Management & Storage", workplaceTypes: ["OFFICE", "MANUAL_LABOUR"] },
  { value: "Automotive", label: "Automotive", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Aviation", label: "Aviation", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Beauty & Personal Care", label: "Beauty & Personal Care", workplaceTypes: ["SERVICE"] },
  { value: "Building & Property Management", label: "Building & Property Management", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Call Center / Customer Support", label: "Call Center / Customer Support", workplaceTypes: ["SERVICE", "HYBRID_REMOTE"] },
  { value: "Chemicals", label: "Chemicals", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Communications Consulting", label: "Communications Consulting", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Communities", label: "Communities", workplaceTypes: ["SERVICE", "OFFICE"] },
  { value: "Construction", label: "Construction", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Consulting", label: "Consulting", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Courier & Cargo Services", label: "Courier & Cargo Services", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Defense & Aerospace", label: "Defense & Aerospace", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Dental", label: "Dental", workplaceTypes: ["SERVICE"] },
  { value: "Drilling", label: "Drilling", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Durable Consumer Goods", label: "Durable Consumer Goods", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "E-commerce", label: "E-commerce", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Education", label: "Education", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Electrical & Electronics", label: "Electrical & Electronics", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Energy", label: "Energy", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Entertainment - Culture - Art", label: "Entertainment - Culture - Art", workplaceTypes: ["SERVICE", "OFFICE"] },
  { value: "Environment", label: "Environment", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Event Organization", label: "Event Organization", workplaceTypes: ["SERVICE", "OFFICE"] },
  { value: "Fast-Moving Consumer Goods (FMCG)", label: "Fast-Moving Consumer Goods (FMCG)", workplaceTypes: ["OFFICE", "MANUAL_LABOUR"] },
  { value: "Finance & Economy", label: "Finance & Economy", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Food & Beverage", label: "Food & Beverage", workplaceTypes: ["SERVICE", "MANUAL_LABOUR"] },
  { value: "Forest Products", label: "Forest Products", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Furniture & Accessories", label: "Furniture & Accessories", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Healthcare", label: "Healthcare", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Highway, Tunnel & Bridge Operations", label: "Highway, Tunnel & Bridge Operations", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Household Goods", label: "Household Goods", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Human Resources & Recruitment", label: "Human Resources & Recruitment", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Industry", label: "Industry", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "IT", label: "Information Technology (IT)", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Insurance", label: "Insurance", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Legal Services", label: "Legal Services", workplaceTypes: ["OFFICE"] },
  { value: "Livestock & Animal Husbandry", label: "Livestock & Animal Husbandry", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Logistics", label: "Logistics", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Manufacturing / Industrial Products", label: "Manufacturing / Industrial Products", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Marine Supply Industry", label: "Marine Supply Industry", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Maritime", label: "Maritime", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Media", label: "Media", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Mining & Metals", label: "Mining & Metals", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Office Supplies", label: "Office Supplies", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Printing & Publishing", label: "Printing & Publishing", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Retail", label: "Retail", workplaceTypes: ["SERVICE"] },
  { value: "Security", label: "Security", workplaceTypes: ["SERVICE", "MANUAL_LABOUR"] },
  { value: "Services", label: "Services", workplaceTypes: ["SERVICE", "OFFICE"] },
  { value: "Telecommunications", label: "Telecommunications", workplaceTypes: ["OFFICE", "MANUAL_LABOUR"] },
  { value: "Textile", label: "Textile", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Tourism", label: "Tourism", workplaceTypes: ["SERVICE"] },
  { value: "Trade / Commerce", label: "Trade / Commerce", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Waste Management & Recycling", label: "Waste Management & Recycling", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Welding & Cutting Equipment", label: "Welding & Cutting Equipment", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Other", label: "Other", workplaceTypes: ["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"] },
];

async function main() {
  await prisma.sector.deleteMany({});
  await prisma.sector.createMany({ data: SECTORS });
  console.log(`Seeded ${SECTORS.length} sectors.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
