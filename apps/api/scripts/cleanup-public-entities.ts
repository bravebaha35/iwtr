// Deletes public/state/government/political entities from the company
// directory, per the classification worked out interactively (dry run +
// manual review of every "Genel Müdürlük"/acronym match — see conversation).
// Exemption keywords are checked before removal keywords, and MANUAL_KEEP_OVERRIDES
// hard-excludes specific names the automated classifier got wrong (private
// companies whose HQ got tagged "Genel Müdürlük" in OSM, a labor union that
// matched "Belediye" as a name prefix, etc.) regardless of what they matched.
//
// Run from apps/api: pnpm exec ts-node scripts/cleanup-public-entities.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

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

function matchesKeyword(normalizedHaystack: string, keyword: string): boolean {
  const normalizedKeyword = normalizeTr(keyword);
  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u");
  return pattern.test(normalizedHaystack);
}

const GOVERNMENT_OFFICES = [
  "Valiliği", "Kaymakamlığı", "Belediyesi", "Belediye", "Bakanlığı", "Müdürlüğü", "Müdürlük",
  "Nüfus Müdürlüğü", "Vergi Dairesi", "SGK", "Emniyet", "Emniyet Müdürlüğü", "Polis", "Jandarma",
  "Adliye", "Adliyesi", "Adalet Sarayı", "Mahkemesi", "Tapu Müdürlüğü", "Tapu Kadastro",
  "Muhtarlığı", "Müftülüğü", "İSKİ", "İZSU", "ASKİ", "OSB Müdürlüğü",
];
// Notaries (noter) are a Ministry-of-Justice-appointed legal function — same
// "civil service" bucket as the rest of this list even though a noter is
// technically self-employed. Missed entirely in the first pass (74 slipped
// through on Istanbul); all variant spellings/suffixes seen in real data.
const NOTARIES = ["Noter", "Noteri", "Noterliği", "Noterlik", "Noter Masası"];
const POLITICAL_PARTIES = [
  "Partisi", "Parti", "İl Başkanlığı", "İlçe Başkanlığı", "Gençlik Kolları", "Kadın Kolları",
  "Siyasi Parti", "AK Parti", "AKP", "CHP", "MHP", "İYİ Parti", "DEM Parti", "Saadet Partisi",
  "DEVA Partisi", "Gelecek Partisi",
  // "Temsilciliği" (representative office) deliberately excluded — it's
  // equally common as private-company terminology (a distributor/regional
  // rep office, e.g. "Mercedes-Benz Türk Temsilciliği"), the same ambiguity
  // "Genel Müdürlük" turned out to have. Any real match needs the same
  // one-by-one manual review "Genel Müdürlük" got, not a blind keyword add.
];
const PUBLIC_SCHOOLS = [
  "İlkokulu", "İlköğretim Okulu", "Ortaokulu", "Anadolu Lisesi", "Fen Lisesi", "İmam Hatip Lisesi",
  "İmam Hatip", "Mesleki ve Teknik Anadolu Lisesi", "Devlet Üniversitesi", "Devlet Okulu",
  "Fakültesi", "Rektörlüğü", "Halk Eğitim Merkezi", "RAM",
];
const PUBLIC_HOSPITALS = [
  "Devlet Hastanesi", "Şehir Hastanesi", "Eğitim ve Araştırma Hastanesi", "Aile Sağlığı Merkezi",
  "ASM", "Toplum Sağlığı Merkezi", "Ağız ve Diş Sağlığı Merkezi", "ADSM", "Sağlık Ocağı",
  "Verem Savaş", "Aşılama Merkezi",
];
const PRIVATE_EXEMPTIONS = [
  "Özel", "Ozel", "Kolej", "Koleji", "Vakıf Üniversitesi", "Dershanesi", "Sürücü Kursu",
  "Öğretim Kursu", "Kreş", "Anaokulu", "Özel Hastane", "Özel Tıp Merkezi", "Özel Poliklinik",
  "Özel Ağız ve Diş Sağlığı", "Diş Kliniği", "Özel Sağlık Kabini", "Vakıf Hastanesi",
];

// Manually reviewed corrections — the keyword classifier would flag these,
// but they're private entities (or, for the labor union, simply not a state
// entity): a labor union whose name happens to start with "Belediye", a
// private shop apparently named after a nearby landmark school, and several
// well-known private companies whose Istanbul HQ got tagged "Genel Müdürlük"
// in OSM (ordinary Turkish corporate-HQ terminology, not exclusively
// governmental). Vakıf Katılım is deliberately NOT here — despite being a
// commercial bank, its majority state-foundation ownership puts it with the
// other state economic enterprises being removed.
const MANUAL_KEEP_OVERRIDES = new Set([
  "Belediye - iş Sendikası",
  "İnönü Mesleki ve Teknik Anadolu Lisesi Satış Ofisi",
  "Asm Inşaat",
  "Boğaziçi Elektrik Dağıtım A.Ş. Beyazıt İşletme Müdürlüğü",
  "Akçansa Genel Müdürlük",
  "Birlik Sigorta Gn. Müdürlüğü",
  "Bosch Türkiye ve Orta Doğu Genel Müdürlük",
  "Çimsa Çimento Genel Müdürlük",
  "Gülaylar Genel Müdürlük",
  "Hedef Filo Genel Müdürlüğü",
  "HSBC Genel Müdürlük",
  "Hyundai Assam Genel Müdürlük",
  "İpekyol Genel Müdürlük Merkez Ofis",
  "İpragaz Genel Müdürlük",
  "Koton Genel Müdürlük",
  "MNG Kargo Genel Müdürlüğü",
  "UPS Türkiye Genel Müdürlüğü",
]);

export type RemovalCategory = "Government Agencies" | "Notaries" | "Political Parties" | "Public Schools" | "Public Hospitals";

// Exported so other scripts (e.g. seed-turkey-companies.ts) can filter
// public/government entities inline at seed time using this exact
// classifier, instead of duplicating the keyword lists or running this as a
// separate post-hoc pass. Guarded below (`require.main === module`) so
// importing this function doesn't also trigger this file's own DB scan.
export function classify(name: string): { action: "delete" | "keep"; category?: RemovalCategory } {
  if (MANUAL_KEEP_OVERRIDES.has(name)) return { action: "keep" };

  const normalized = normalizeTr(name);
  if (PRIVATE_EXEMPTIONS.some((kw) => matchesKeyword(normalized, kw))) return { action: "keep" };

  const categories: [RemovalCategory, string[]][] = [
    ["Government Agencies", GOVERNMENT_OFFICES],
    ["Notaries", NOTARIES],
    ["Political Parties", POLITICAL_PARTIES],
    ["Public Schools", PUBLIC_SCHOOLS],
    ["Public Hospitals", PUBLIC_HOSPITALS],
  ];
  for (const [category, keywords] of categories) {
    if (keywords.some((kw) => matchesKeyword(normalized, kw))) return { action: "delete", category };
  }
  return { action: "keep" };
}

async function main() {
  const prisma = new PrismaClient();
  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const toDeleteIds: string[] = [];
  const byCategory = new Map<RemovalCategory, number>();
  for (const c of companies) {
    const result = classify(c.name);
    if (result.action === "delete" && result.category) {
      toDeleteIds.push(c.id);
      byCategory.set(result.category, (byCategory.get(result.category) ?? 0) + 1);
    }
  }

  console.log("Total companies evaluated:", companies.length);
  console.log("Total flagged for deletion:", toDeleteIds.length);
  for (const cat of ["Government Agencies", "Notaries", "Political Parties", "Public Schools", "Public Hospitals"] as RemovalCategory[]) {
    console.log(`  ${cat}: ${byCategory.get(cat) ?? 0}`);
  }

  // Same dependency order as the earlier test-data purge — child rows before
  // Company itself. These are freshly-seeded OSM entries so review/employment
  // counts should be zero, but delete defensively in case anyone interacted
  // with one since import.
  const result = await prisma.$transaction(async (tx) => {
    const counts = {
      reviewVotes: (await tx.reviewVote.deleteMany({ where: { review: { companyId: { in: toDeleteIds } } } })).count,
      moderationQueueItems: (await tx.moderationQueueItem.deleteMany({ where: { review: { companyId: { in: toDeleteIds } } } })).count,
      reviews: (await tx.review.deleteMany({ where: { companyId: { in: toDeleteIds } } })).count,
      companyOwners: (await tx.companyOwner.deleteMany({ where: { companyId: { in: toDeleteIds } } })).count,
      ownerContactMessages: (await tx.ownerContactMessage.deleteMany({ where: { companyId: { in: toDeleteIds } } })).count,
      companyAggregateScores: (await tx.companyAggregateScore.deleteMany({ where: { companyId: { in: toDeleteIds } } })).count,
      employmentHistories: (await tx.employmentHistory.deleteMany({ where: { companyId: { in: toDeleteIds } } })).count,
      companies: (await tx.company.deleteMany({ where: { id: { in: toDeleteIds } } })).count,
    };
    return counts;
  });

  const remaining = await prisma.company.count();

  console.log("");
  console.log("--- DELETION SUMMARY ---");
  console.log(JSON.stringify(result, null, 2));
  console.log("Remaining active companies:", remaining);

  await prisma.$disconnect();
}

// Only run the DB-scanning main() when this file is executed directly
// (`ts-node scripts/cleanup-public-entities.ts`), not when another script
// imports `classify` from it.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
