import type { WorkplaceType } from "@iwtr/shared-types";

// A finer-grained sector label than Company.category (which is a free-typed
// string) or WorkplaceType (the fixed 4-value axis) — this is purely the
// classifier's internal vocabulary for *why* it picked a given WorkplaceType.
// Deliberately a plain TS union, not a second Prisma enum/column: nothing in
// the schema persists a sector this granular today (Company.category already
// covers "what kind of business", written by admins as free text), so adding
// an unused DB enum here would just be dead weight. If a real per-company
// "sector" column is ever needed, promote this type into shared-types then.
export type JobSector =
  | "Finance, Accounting & Audit"
  | "HR & Admin"
  | "Legal & Compliance"
  | "Banking Branch & Ops"
  | "Real Estate / Property"
  | "Software & Tech"
  | "Digital Marketing & Content"
  | "Product & Design"
  | "Remote Support"
  | "E-Commerce Operations"
  | "Healthcare & Hospitals"
  | "Retail & Stores"
  | "Hospitality & Gastronomy"
  | "Field Sales"
  | "Private Education"
  | "Wellness"
  | "Logistics & Delivery"
  | "Manufacturing & Industrial (OSB)"
  | "Construction & Sites"
  | "Maintenance"
  | "Facility & Security";

export interface SectorKeywordGroup {
  sector: JobSector;
  // Turkish (primary) and a few English synonyms. Matched case-insensitively
  // and TR-locale-aware — see classifyJobRole.ts's matchesAsWord/foldTr.
  // Slash-joined terms from the source spec (e.g. "TIR/Kamyon Şoförü",
  // "Sıcak/Soğuk Satış Elemanı") are split into separate full keywords
  // rather than kept as one literal string, since a job title will only
  // ever contain one side of the slash, never both.
  keywords: string[];
}

// Fixed priority order used only to break ties when two WorkplaceTypes score
// an equal number of keyword hits (see classifyWorkplace) — arbitrary but
// deterministic, listed roughly white-collar-first.
export const WORKPLACE_TYPE_ORDER: WorkplaceType[] = ["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"];

export const WORKPLACE_CATEGORY_MAP: Record<WorkplaceType, SectorKeywordGroup[]> = {
  OFFICE: [
    {
      sector: "Finance, Accounting & Audit",
      keywords: ["Finans", "Muhasebe", "Mali Müşavir", "Denetçi", "Finansal Analist"],
    },
    {
      sector: "HR & Admin",
      keywords: ["İnsan Kaynakları", "Recruiter", "İdari İşler", "Ofis Yöneticisi"],
    },
    {
      sector: "Legal & Compliance",
      keywords: ["Hukuk", "Avukat", "Uyum Uzmanı", "Mevzuat"],
    },
    {
      sector: "Banking Branch & Ops",
      keywords: ["Banka Gişe", "Banka Operasyon", "Sigorta Eksperi"],
    },
    {
      sector: "Real Estate / Property",
      keywords: ["Portföy Yöneticisi", "Gayrimenkul Danışmanı"],
    },
  ],
  HYBRID_REMOTE: [
    {
      sector: "Software & Tech",
      keywords: [
        "Yazılım Geliştirici",
        "Frontend",
        "Backend",
        "Fullstack",
        "DevOps",
        "Veri Analisti",
        "Sistem Yöneticisi",
        "Developer",
        "Software Engineer",
      ],
    },
    {
      sector: "Digital Marketing & Content",
      keywords: ["Dijital Pazarlama", "SEO", "SEM", "Sosyal Medya Yöneticisi", "Metin Yazarı"],
    },
    {
      sector: "Product & Design",
      keywords: ["UI/UX", "UI", "UX", "Grafik Tasarım", "Ürün Yöneticisi", "Product Manager", "Scrum Master"],
    },
    {
      sector: "Remote Support",
      keywords: ["Uzaktan Çağrı Merkezi", "Müşteri Başarısı", "Customer Success"],
    },
    {
      sector: "E-Commerce Operations",
      keywords: ["E-Ticaret Uzmanı", "Pazaryeri Yöneticisi"],
    },
  ],
  SERVICE: [
    {
      sector: "Healthcare & Hospitals",
      keywords: ["Doktor", "Hemşire", "Hasta Bakıcı", "Tıbbi Mümessil", "Tıbbi Sekreter", "Klinik Elemanı"],
    },
    {
      sector: "Retail & Stores",
      keywords: ["Saha Satış Danışmanı", "Mağaza Müdürü", "Kasiyer", "Görsel Düzenleme"],
    },
    {
      sector: "Hospitality & Gastronomy",
      keywords: ["Garson", "Komi", "Aşçı", "Resepsiyonist", "Kat Hizmetleri", "Tur Rehberi"],
    },
    {
      sector: "Field Sales",
      keywords: ["Saha Satış Temsilcisi", "Sıcak Satış Elemanı", "Soğuk Satış Elemanı", "Bölge Satış Sorumlusu"],
    },
    {
      sector: "Private Education",
      keywords: ["Özel Okul Öğretmeni", "Dershane Eğitmeni", "Eğitim Danışmanı"],
    },
    {
      sector: "Wellness",
      keywords: ["Güzellik Uzmanı", "Estetisyen", "Fitness Koçu"],
    },
  ],
  MANUAL_LABOUR: [
    {
      sector: "Logistics & Delivery",
      keywords: [
        "Depo Elemanı",
        "Moto Kurye",
        "Araçlı Kurye",
        "TIR Şoförü",
        "Kamyon Şoförü",
        "Forklift Operatörü",
        "Mal Kabul",
      ],
    },
    {
      sector: "Manufacturing & Industrial (OSB)",
      keywords: ["Üretim Hattı İşçisi", "Makine Operatörü", "Kalite Kontrol", "Montaj", "Kaynakçı", "Tekstil İşçisi"],
    },
    {
      sector: "Construction & Sites",
      keywords: ["Şantiye İşçisi", "Elektrik Ustası", "Tesisatçı", "Boyacı", "İnşaat Teknikeri", "Vinç Operatörü"],
    },
    {
      sector: "Maintenance",
      keywords: ["Saha Teknikeri", "İklimlendirme Teknikeri", "Sanayi Bakım Onarım", "Oto Tamircisi"],
    },
    {
      sector: "Facility & Security",
      keywords: ["Özel Güvenlik", "Temizlik Personeli", "Bina Bakım Elemanı"],
    },
  ],
};
