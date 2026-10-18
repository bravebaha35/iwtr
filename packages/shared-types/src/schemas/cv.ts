import { z } from "zod";
import { jobPositionSchema } from "./jobPosting";

// ---------------------------------------------------------------------------
// References (Edit Profile > References), printed on the member's CV.
// ---------------------------------------------------------------------------

export const MAX_REFERENCES_PER_MEMBER = 5;

// Any country, E.164 shape (what PhoneNumberInput produces): "+" and 8-15 digits.
const referencePhoneSchema = z
  .string()
  .trim()
  .regex(/^\+\d{8,15}$/, "Enter a valid phone number.");

// No custom message: the form names the field ("Please check your first name.").
const personNameSchema = z.string().trim().min(1).max(60);

export const referenceInputSchema = z
  .object({
    firstName: personNameSchema,
    lastName: personNameSchema,
    position: jobPositionSchema,
    // "" (an empty form field) means "none".
    email: z.union([z.string().trim().toLowerCase().email("Enter a valid email address.").max(254), z.literal("")]),
    phoneNumber: z.union([referencePhoneSchema, z.literal("")]),
  })
  .refine((v) => v.email !== "" || v.phoneNumber !== "", {
    message: "Add an email address or a phone number, so an employer can reach this reference.",
    path: ["email"],
  });
export type ReferenceInput = z.infer<typeof referenceInputSchema>;

export const memberReferenceSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  position: jobPositionSchema,
  email: z.string().nullable(),
  phoneNumber: z.string().nullable(),
});
export type MemberReference = z.infer<typeof memberReferenceSchema>;

// ---------------------------------------------------------------------------
// Certificates (Edit Profile > Personal Information), printed on the CV.
// ---------------------------------------------------------------------------

export const MAX_CERTIFICATES_PER_MEMBER = 15;
export const CERTIFICATE_DESCRIPTION_MAX_LENGTH = 2000;

export const certificateInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the certificate's name.").max(120, "Use 120 characters or fewer."),
  issuer: z.string().trim().min(2, "Enter who issued it.").max(120, "Use 120 characters or fewer."),
  // "YYYY-MM"
  issuedMonth: z.string().regex(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/, "Pick the month and year."),
  description: z.string().trim().max(CERTIFICATE_DESCRIPTION_MAX_LENGTH).optional().default(""),
});
export type CertificateInput = z.input<typeof certificateInputSchema>;

export const memberCertificateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  issuer: z.string(),
  issuedMonth: z.string(),
  description: z.string().nullable(),
});
export type MemberCertificate = z.infer<typeof memberCertificateSchema>;

export interface CertificateCatalogEntry {
  name: string;
  // Filled in for the member when they pick this certificate; still editable.
  issuer: string;
}

/**
 * The certificate picker's list: widely recognised certificates employers in
 * Turkey ask for, across every kind of work on the site. Not exhaustive on
 * purpose - a member can always type one that isn't here. Names stay in their
 * official form (most are never translated).
 */
export const CERTIFICATE_CATALOG: CertificateCatalogEntry[] = [
  // Project and process management
  { name: "PMP (Project Management Professional)", issuer: "Project Management Institute (PMI)" },
  { name: "CAPM (Certified Associate in Project Management)", issuer: "Project Management Institute (PMI)" },
  { name: "PMI-ACP (Agile Certified Practitioner)", issuer: "Project Management Institute (PMI)" },
  { name: "PRINCE2 Foundation", issuer: "PeopleCert / AXELOS" },
  { name: "PRINCE2 Practitioner", issuer: "PeopleCert / AXELOS" },
  { name: "Professional Scrum Master I (PSM I)", issuer: "Scrum.org" },
  { name: "Professional Scrum Product Owner I (PSPO I)", issuer: "Scrum.org" },
  { name: "Certified ScrumMaster (CSM)", issuer: "Scrum Alliance" },
  { name: "SAFe Agilist", issuer: "Scaled Agile" },
  { name: "ITIL 4 Foundation", issuer: "PeopleCert / AXELOS" },
  { name: "Lean Six Sigma Yellow Belt", issuer: "" },
  { name: "Lean Six Sigma Green Belt", issuer: "" },
  { name: "Lean Six Sigma Black Belt", issuer: "" },
  { name: "Certified Business Analysis Professional (CBAP)", issuer: "IIBA" },

  // Quality, environment and standards
  { name: "ISO 9001 Baş Denetçi (Lead Auditor)", issuer: "" },
  { name: "ISO 9001 İç Denetçi (Internal Auditor)", issuer: "" },
  { name: "ISO 14001 Baş Denetçi (Lead Auditor)", issuer: "" },
  { name: "ISO 45001 Baş Denetçi (Lead Auditor)", issuer: "" },
  { name: "ISO 27001 Baş Denetçi (Lead Auditor)", issuer: "" },
  { name: "ISO 27001 Lead Implementer", issuer: "" },
  { name: "ISO 22000 Gıda Güvenliği Denetçisi", issuer: "" },
  { name: "ISO 50001 Enerji Yönetimi Denetçisi", issuer: "" },
  { name: "Certified Quality Engineer (CQE)", issuer: "ASQ" },

  // Occupational health and safety, first aid
  { name: "İş Güvenliği Uzmanlığı (A Sınıfı)", issuer: "T.C. Çalışma ve Sosyal Güvenlik Bakanlığı" },
  { name: "İş Güvenliği Uzmanlığı (B Sınıfı)", issuer: "T.C. Çalışma ve Sosyal Güvenlik Bakanlığı" },
  { name: "İş Güvenliği Uzmanlığı (C Sınıfı)", issuer: "T.C. Çalışma ve Sosyal Güvenlik Bakanlığı" },
  { name: "İşyeri Hekimliği Belgesi", issuer: "T.C. Çalışma ve Sosyal Güvenlik Bakanlığı" },
  { name: "Diğer Sağlık Personeli (DSP) Belgesi", issuer: "T.C. Çalışma ve Sosyal Güvenlik Bakanlığı" },
  { name: "Temel İş Sağlığı ve Güvenliği Eğitimi", issuer: "" },
  { name: "İlk Yardım Sertifikası", issuer: "T.C. Sağlık Bakanlığı onaylı eğitim merkezi" },
  { name: "Yangın Güvenliği ve Söndürme Eğitimi", issuer: "" },
  { name: "Yüksekte Çalışma Eğitimi", issuer: "" },
  { name: "Kapalı Alanda Çalışma Eğitimi", issuer: "" },
  { name: "NEBOSH International General Certificate", issuer: "NEBOSH" },
  { name: "BLS (Basic Life Support)", issuer: "American Heart Association" },
  { name: "ACLS (Advanced Cardiovascular Life Support)", issuer: "American Heart Association" },

  // Vocational licences: driving, operators, trades (Turkey)
  { name: "MYK Mesleki Yeterlilik Belgesi", issuer: "Mesleki Yeterlilik Kurumu (MYK)" },
  { name: "Ustalık Belgesi", issuer: "T.C. Milli Eğitim Bakanlığı" },
  { name: "Kalfalık Belgesi", issuer: "T.C. Milli Eğitim Bakanlığı" },
  { name: "SRC 1 (Uluslararası Yolcu Taşımacılığı)", issuer: "T.C. Ulaştırma ve Altyapı Bakanlığı" },
  { name: "SRC 2 (Yurt İçi Yolcu Taşımacılığı)", issuer: "T.C. Ulaştırma ve Altyapı Bakanlığı" },
  { name: "SRC 3 (Uluslararası Eşya Taşımacılığı)", issuer: "T.C. Ulaştırma ve Altyapı Bakanlığı" },
  { name: "SRC 4 (Yurt İçi Eşya Taşımacılığı)", issuer: "T.C. Ulaştırma ve Altyapı Bakanlığı" },
  { name: "SRC 5 (Tehlikeli Madde Taşımacılığı)", issuer: "T.C. Ulaştırma ve Altyapı Bakanlığı" },
  { name: "ADR Sürücü Eğitim Sertifikası", issuer: "T.C. Ulaştırma ve Altyapı Bakanlığı" },
  { name: "Psikoteknik Değerlendirme Belgesi", issuer: "" },
  { name: "Forklift Operatör Belgesi", issuer: "" },
  { name: "Vinç Operatör Belgesi", issuer: "" },
  { name: "İş Makinesi Operatör Belgesi", issuer: "" },
  { name: "Kaynakçı Sertifikası (EN ISO 9606)", issuer: "" },
  { name: "Elektrik Tesisatçısı Yetki Belgesi (EMO)", issuer: "Elektrik Mühendisleri Odası" },
  { name: "Doğalgaz Tesisat Yetki Belgesi", issuer: "" },
  { name: "Asansör Bakım Onarım Belgesi", issuer: "" },
  { name: "Özel Güvenlik Görevlisi Kimlik Kartı", issuer: "T.C. İçişleri Bakanlığı" },

  // Finance, accounting, audit, banking (Turkey and international)
  { name: "SMMM (Serbest Muhasebeci Mali Müşavir)", issuer: "TÜRMOB" },
  { name: "YMM (Yeminli Mali Müşavir)", issuer: "TÜRMOB" },
  { name: "Bağımsız Denetçi Lisansı", issuer: "Kamu Gözetimi Kurumu (KGK)" },
  { name: "SPK Düzey 1 Lisansı", issuer: "Sermaye Piyasası Kurulu (SPK) / SPL" },
  { name: "SPK Düzey 2 Lisansı", issuer: "Sermaye Piyasası Kurulu (SPK) / SPL" },
  { name: "SPK Düzey 3 Lisansı", issuer: "Sermaye Piyasası Kurulu (SPK) / SPL" },
  { name: "SPK Türev Araçlar Lisansı", issuer: "Sermaye Piyasası Kurulu (SPK) / SPL" },
  { name: "SPK Kurumsal Yönetim Derecelendirme Lisansı", issuer: "Sermaye Piyasası Kurulu (SPK) / SPL" },
  { name: "SPK Gayrimenkul Değerleme Lisansı", issuer: "Sermaye Piyasası Kurulu (SPK) / SPL" },
  { name: "Sigorta Acenteliği Teknik Personel Belgesi", issuer: "Sigortacılık Eğitim Merkezi (SEGEM)" },
  { name: "Bireysel Emeklilik Aracısı Lisansı", issuer: "Emeklilik Gözetim Merkezi (EGM)" },
  { name: "CFA (Chartered Financial Analyst)", issuer: "CFA Institute" },
  { name: "FRM (Financial Risk Manager)", issuer: "GARP" },
  { name: "ACCA", issuer: "Association of Chartered Certified Accountants" },
  { name: "CPA (Certified Public Accountant)", issuer: "AICPA" },
  { name: "CIA (Certified Internal Auditor)", issuer: "The Institute of Internal Auditors (IIA)" },
  { name: "CISA (Certified Information Systems Auditor)", issuer: "ISACA" },
  { name: "CFE (Certified Fraud Examiner)", issuer: "ACFE" },
  { name: "CMA (Certified Management Accountant)", issuer: "IMA" },
  { name: "Dış Ticaret Uzmanlığı Sertifikası", issuer: "" },
  { name: "Gümrük Müşavir Yardımcılığı Belgesi", issuer: "T.C. Ticaret Bakanlığı" },

  // Human resources and law
  { name: "SHRM-CP", issuer: "SHRM" },
  { name: "SHRM-SCP", issuer: "SHRM" },
  { name: "PHR (Professional in Human Resources)", issuer: "HRCI" },
  { name: "CIPD Level 5", issuer: "CIPD" },
  { name: "KVKK Uyum ve Veri Koruma Sertifikası", issuer: "" },
  { name: "CIPP/E (Certified Information Privacy Professional)", issuer: "IAPP" },
  { name: "Arabuluculuk Sertifikası", issuer: "T.C. Adalet Bakanlığı" },

  // Software, cloud, data
  { name: "AWS Certified Cloud Practitioner", issuer: "Amazon Web Services" },
  { name: "AWS Certified Solutions Architect - Associate", issuer: "Amazon Web Services" },
  { name: "AWS Certified Developer - Associate", issuer: "Amazon Web Services" },
  { name: "AWS Certified Solutions Architect - Professional", issuer: "Amazon Web Services" },
  { name: "Microsoft Certified: Azure Fundamentals (AZ-900)", issuer: "Microsoft" },
  { name: "Microsoft Certified: Azure Administrator Associate (AZ-104)", issuer: "Microsoft" },
  { name: "Microsoft Certified: Azure Developer Associate (AZ-204)", issuer: "Microsoft" },
  { name: "Microsoft Certified: Azure Solutions Architect Expert", issuer: "Microsoft" },
  { name: "Microsoft Certified: Power BI Data Analyst Associate (PL-300)", issuer: "Microsoft" },
  { name: "Microsoft Office Specialist (MOS) Excel", issuer: "Microsoft" },
  { name: "Microsoft Office Specialist (MOS) Word", issuer: "Microsoft" },
  { name: "Microsoft Office Specialist (MOS) Expert", issuer: "Microsoft" },
  { name: "Google Cloud Associate Cloud Engineer", issuer: "Google Cloud" },
  { name: "Google Cloud Professional Cloud Architect", issuer: "Google Cloud" },
  { name: "Google Cloud Professional Data Engineer", issuer: "Google Cloud" },
  { name: "Google Data Analytics Professional Certificate", issuer: "Google" },
  { name: "Google IT Support Professional Certificate", issuer: "Google" },
  { name: "Google UX Design Professional Certificate", issuer: "Google" },
  { name: "Certified Kubernetes Administrator (CKA)", issuer: "The Linux Foundation / CNCF" },
  { name: "Certified Kubernetes Application Developer (CKAD)", issuer: "The Linux Foundation / CNCF" },
  { name: "HashiCorp Certified: Terraform Associate", issuer: "HashiCorp" },
  { name: "Red Hat Certified System Administrator (RHCSA)", issuer: "Red Hat" },
  { name: "Red Hat Certified Engineer (RHCE)", issuer: "Red Hat" },
  { name: "Linux Professional Institute LPIC-1", issuer: "Linux Professional Institute" },
  { name: "Oracle Certified Professional, Java SE Developer", issuer: "Oracle" },
  { name: "Oracle Database SQL Certified Associate", issuer: "Oracle" },
  { name: "Salesforce Certified Administrator", issuer: "Salesforce" },
  { name: "Salesforce Certified Platform Developer I", issuer: "Salesforce" },
  { name: "SAP Certified Application Associate", issuer: "SAP" },
  { name: "ISTQB Certified Tester Foundation Level (CTFL)", issuer: "ISTQB" },
  { name: "Tableau Desktop Specialist", issuer: "Tableau (Salesforce)" },
  { name: "Databricks Certified Data Engineer Associate", issuer: "Databricks" },
  { name: "TensorFlow Developer Certificate", issuer: "Google" },

  // Networks and security
  { name: "CompTIA A+", issuer: "CompTIA" },
  { name: "CompTIA Network+", issuer: "CompTIA" },
  { name: "CompTIA Security+", issuer: "CompTIA" },
  { name: "Cisco CCNA", issuer: "Cisco" },
  { name: "Cisco CCNP Enterprise", issuer: "Cisco" },
  { name: "CISSP", issuer: "ISC2" },
  { name: "CISM (Certified Information Security Manager)", issuer: "ISACA" },
  { name: "CEH (Certified Ethical Hacker)", issuer: "EC-Council" },
  { name: "OSCP (Offensive Security Certified Professional)", issuer: "OffSec" },
  { name: "Fortinet NSE 4", issuer: "Fortinet" },

  // Marketing, sales, e-commerce
  { name: "Google Ads Search Certification", issuer: "Google" },
  { name: "Google Analytics Certification", issuer: "Google" },
  { name: "Google Digital Garage: Dijital Pazarlamanın Temelleri", issuer: "Google" },
  { name: "Meta Certified Digital Marketing Associate", issuer: "Meta" },
  { name: "HubSpot Inbound Marketing Certification", issuer: "HubSpot Academy" },
  { name: "HubSpot Content Marketing Certification", issuer: "HubSpot Academy" },
  { name: "Semrush SEO Toolkit Certification", issuer: "Semrush Academy" },
  { name: "Amazon Seller Central Eğitim Sertifikası", issuer: "" },

  // Design and engineering software
  { name: "Adobe Certified Professional: Photoshop", issuer: "Adobe" },
  { name: "Adobe Certified Professional: Illustrator", issuer: "Adobe" },
  { name: "Adobe Certified Professional: Premiere Pro", issuer: "Adobe" },
  { name: "Autodesk Certified Professional: AutoCAD", issuer: "Autodesk" },
  { name: "Autodesk Certified Professional: Revit", issuer: "Autodesk" },
  { name: "CSWA (Certified SOLIDWORKS Associate)", issuer: "Dassault Systèmes" },
  { name: "CSWP (Certified SOLIDWORKS Professional)", issuer: "Dassault Systèmes" },
  { name: "LEED Green Associate", issuer: "U.S. Green Building Council" },
  { name: "Enerji Yöneticisi Sertifikası", issuer: "T.C. Enerji ve Tabii Kaynaklar Bakanlığı" },

  // Logistics and supply chain
  { name: "APICS CSCP (Certified Supply Chain Professional)", issuer: "ASCM" },
  { name: "APICS CPIM (Certified in Planning and Inventory Management)", issuer: "ASCM" },
  { name: "CIPS Level 4 Diploma in Procurement and Supply", issuer: "CIPS" },
  { name: "FIATA Diploma in Freight Forwarding", issuer: "FIATA / UTİKAD" },
  { name: "IATA Tehlikeli Madde Eğitimi (DGR)", issuer: "IATA" },

  // Hospitality, food, retail, care
  { name: "Hijyen Eğitimi Belgesi", issuer: "T.C. Milli Eğitim Bakanlığı onaylı kurum" },
  { name: "HACCP Eğitim Sertifikası", issuer: "" },
  { name: "Barista Sertifikası (SCA)", issuer: "Specialty Coffee Association" },
  { name: "WSET Level 2 Award in Wines", issuer: "WSET" },
  { name: "Aşçılık Sertifikası", issuer: "" },
  { name: "Turist Rehberliği Ruhsatnamesi", issuer: "Türkiye Turist Rehberleri Birliği (TUREB)" },
  { name: "Emlak Danışmanlığı Seviye 5 (MYK)", issuer: "Mesleki Yeterlilik Kurumu (MYK)" },
  { name: "Hasta ve Yaşlı Bakımı Sertifikası", issuer: "" },
  { name: "Çocuk Gelişimi ve Bakımı Sertifikası", issuer: "" },

  // Teaching
  { name: "Pedagojik Formasyon Sertifikası", issuer: "" },
  { name: "CELTA", issuer: "Cambridge English" },
  { name: "DELTA", issuer: "Cambridge English" },
  { name: "TESOL / TEFL Sertifikası", issuer: "" },

  // Languages
  { name: "IELTS Academic", issuer: "British Council / IDP / Cambridge" },
  { name: "TOEFL iBT", issuer: "ETS" },
  { name: "TOEIC", issuer: "ETS" },
  { name: "YDS (Yabancı Dil Bilgisi Seviye Tespit Sınavı)", issuer: "ÖSYM" },
  { name: "YÖKDİL", issuer: "ÖSYM" },
  { name: "Cambridge C1 Advanced (CAE)", issuer: "Cambridge English" },
  { name: "Cambridge C2 Proficiency (CPE)", issuer: "Cambridge English" },
  { name: "Goethe-Zertifikat", issuer: "Goethe-Institut" },
  { name: "TestDaF", issuer: "TestDaF-Institut" },
  { name: "DELF / DALF", issuer: "France Éducation international" },
  { name: "DELE", issuer: "Instituto Cervantes" },
  { name: "CILS / CELI", issuer: "" },
  { name: "JLPT", issuer: "Japan Foundation" },
  { name: "HSK", issuer: "Chinese Testing International" },
  { name: "TORFL (TRKI)", issuer: "" },
];
