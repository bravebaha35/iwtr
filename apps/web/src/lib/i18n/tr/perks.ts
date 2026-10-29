import { PERK_CATALOG } from "@iwtr/shared-types";

// Turkish for Perks ("Yan Haklar") and Salary Information ("Maaş Bilgisi").
// Each perk's own name comes from the shared catalogue, so its English and
// Turkish never drift apart.
const perks: Record<string, string> = {
  ...Object.fromEntries(PERK_CATALOG.map((p) => [p.en, p.tr])),
  "Perks": "Yan Haklar",
  "Search perks, e.g. meal card": "Yan hak ara, ör. yemek kartı",
  "Pick from the list. You can choose up to {n}.": "Listeden seç. En fazla {n} tane seçebilirsin.",
  "No perk matches that. Try another word.": "Bu kelimeyle eşleşen yan hak yok. Başka bir kelime dene.",
  "You've picked the most perks you can.": "Seçebileceğin en fazla yan hakkı seçtin.",
  "Remove {perk}": "{perk} kaldır",
  "No perks listed yet.": "Henüz yan hak eklenmemiş.",
  "Salary Information": "Maaş Bilgisi",
  "Monthly net salary": "Aylık net maaş",
  "Currency": "Para birimi",
  "Will be shared at the interview": "Mülakatta paylaşılacak",
  "Salary shared at the interview": "Maaş mülakatta paylaşılır",
  "{amount} / month": "{amount} / ay",
  "Monthly net": "Aylık net",
  "Sector average for {sector}: {amount} a month": "{sector} sektör ortalaması: aylık {amount}",
  "From {n} job ads with a salary in ₺.": "₺ maaş bilgisi olan {n} iş ilanından.",
  "Not enough job ads with a salary in this sector yet to show an average.":
    "Bu sektörde ortalama gösterecek kadar maaş bilgisi olan iş ilanı henüz yok.",
  "Amounts in $ or € stay as they are, they are never converted.": "$ veya € ile girilen tutarlar olduğu gibi kalır, çevrilmez.",
  "Enter the monthly salary, or tick that it will be shared at the interview":
    "Aylık maaşı gir ya da mülakatta paylaşılacağını işaretle",
};

export default perks;
