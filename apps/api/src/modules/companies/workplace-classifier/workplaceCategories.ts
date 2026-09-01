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
  | "Executive & Administration"
  | "Finance, Accounting & Audit"
  | "HR & Admin"
  | "Legal & Compliance"
  | "Banking Branch & Ops"
  | "Real Estate / Property"
  | "Traditional Engineering"
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
  | "Facility & Security"
  | "Energy";

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
      sector: "Executive & Administration",
      keywords: [
        "CEO",
        "Genel Müdür",
        "Departman Direktörü",
        "Şube Müdürü",
        "Yönetici Asistanı",
        "Veri Giriş Elemanı",
        "Satınalma",
      ],
    },
    {
      sector: "Finance, Accounting & Audit",
      keywords: ["Finans", "Muhasebe", "Mali Müşavir", "Denetçi", "Finansal Analist"],
    },
    {
      sector: "HR & Admin",
      keywords: ["İnsan Kaynakları", "Recruiter", "İdari İşler", "Ofis Yöneticisi", "Bordro Uzmanı", "İK İş Ortağı"],
    },
    {
      sector: "Legal & Compliance",
      keywords: ["Hukuk", "Avukat", "Uyum Uzmanı", "Mevzuat", "İcra Katibi"],
    },
    {
      sector: "Banking Branch & Ops",
      keywords: ["Banka Gişe", "Banka Operasyon", "Sigorta Eksperi"],
    },
    {
      sector: "Real Estate / Property",
      keywords: ["Portföy Yöneticisi", "Gayrimenkul Danışmanı"],
    },
    {
      sector: "Traditional Engineering",
      keywords: ["Mimari Çizim", "Planlama Mühendisi", "Maliyet Kontrol Mühendisi"],
    },
    // Energy sits under both OFFICE and MANUAL_LABOUR (see the MANUAL_LABOUR
    // copy of this group below) — the same cross-over the frontend's own
    // independent sector list (apps/web/src/lib/sectors.ts) already tags
    // "Energy" with. This half covers the desk-side/admin roles.
    {
      sector: "Energy",
      keywords: ["Enerji Mühendisi", "Enerji Analisti", "Enerji Verimliliği Uzmanı", "Proje Mühendisi (Enerji)"],
    },
    // Software & Tech also sits under HYBRID_REMOTE (see below) — the spec's
    // "Tech maps to Office and Hybrid/Remote" cross-over.
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
        "Siber Güvenlik",
        "Veri Bilimci",
        "Veri Mühendisi",
      ],
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
        "Siber Güvenlik",
        "Veri Bilimci",
        "Veri Mühendisi",
      ],
    },
    {
      sector: "Digital Marketing & Content",
      keywords: ["Dijital Pazarlama", "SEO", "SEM", "Sosyal Medya Yöneticisi", "Metin Yazarı"],
    },
    {
      sector: "Product & Design",
      keywords: [
        "UI/UX",
        "UI",
        "UX",
        "Grafik Tasarım",
        "Ürün Yöneticisi",
        "Product Manager",
        "Scrum Master",
        "3D Artist",
      ],
    },
    {
      sector: "Remote Support",
      keywords: [
        "Uzaktan Çağrı Merkezi",
        "Müşteri Başarısı",
        "Customer Success",
        "Telesatış",
        "Uzaktan Müşteri Destek",
        "Sanal Asistan",
        "Çevirmen",
      ],
    },
    {
      sector: "E-Commerce Operations",
      keywords: ["E-Ticaret Uzmanı", "Pazaryeri Yöneticisi"],
    },
  ],
  SERVICE: [
    {
      sector: "Healthcare & Hospitals",
      keywords: [
        "Doktor",
        "Hemşire",
        "Hasta Bakıcı",
        "Tıbbi Mümessil",
        "Tıbbi Sekreter",
        "Klinik Elemanı",
        "Diş Hekimi",
        "Fizyoterapist",
        "Eczacı",
        "Psikolog",
      ],
    },
    {
      sector: "Retail & Stores",
      keywords: ["Saha Satış Danışmanı", "Satış Danışmanı", "Mağaza Müdürü", "Kasiyer", "Görsel Düzenleme"],
    },
    {
      sector: "Hospitality & Gastronomy",
      keywords: ["Garson", "Komi", "Aşçı", "Resepsiyonist", "Kat Hizmetleri", "Tur Rehberi", "Barista"],
    },
    {
      sector: "Field Sales",
      keywords: ["Saha Satış Temsilcisi", "Sıcak Satış Elemanı", "Soğuk Satış Elemanı", "Bölge Satış Sorumlusu"],
    },
    {
      sector: "Private Education",
      keywords: ["Özel Okul Öğretmeni", "Öğretmen", "Dershane Eğitmeni", "Eğitim Danışmanı", "Rehberlik (PDR)", "Dadı"],
    },
    {
      sector: "Wellness",
      keywords: ["Güzellik Uzmanı", "Estetisyen", "Fitness Koçu", "Kuaför", "Spor Eğitmeni"],
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
      keywords: [
        "Üretim Hattı İşçisi",
        "Üretim İşçisi",
        "Makine Operatörü",
        "Kalite Kontrol",
        "Montaj",
        "Kaynakçı",
        "Tekstil İşçisi",
        "CNC Operatörü",
        "Ambalaj",
      ],
    },
    {
      sector: "Construction & Sites",
      keywords: [
        "Şantiye İşçisi",
        "Elektrik Ustası",
        "Tesisatçı",
        "Boyacı",
        "İnşaat Teknikeri",
        "Vinç Operatörü",
        "Demirci",
      ],
    },
    {
      sector: "Maintenance",
      keywords: ["Saha Teknikeri", "İklimlendirme Teknikeri", "Sanayi Bakım Onarım", "Oto Tamircisi", "Asansör Bakım"],
    },
    {
      sector: "Facility & Security",
      keywords: ["Özel Güvenlik", "Güvenlik Görevlisi", "Temizlik Personeli", "Bina Bakım Elemanı", "Kapıcı", "Atık Toplama"],
    },
    // See the OFFICE copy of this group above for why Energy appears twice.
    // This half covers the field/plant-side roles.
    {
      sector: "Energy",
      keywords: ["Enerji Santrali Operatörü", "Rafineri İşçisi", "Petrol Sahası İşçisi", "Rüzgar Türbini Teknisyeni", "Elektrik Santrali Teknisyeni"],
    },
  ],
};
