// Turkish for the 40 anonymous usernames (ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE
// in shared-types). The stored value stays the English name; every place a
// username is shown passes it through t(), so a Turkish reader sees these.
// Jokes are carried over rather than translated word for word: "Karen" means
// nothing in Turkey, so Karen's Nemesis is the grumpy customer's nightmare,
// and "...Whisperer" is the Turkish "...Dilinden Anlayan".
const usernames: Record<string, string> = {
  // Office
  "Chief Happiness Officer": "Mutluluk Müdürü",
  "Spreadsheet Maestro": "Excel Maestrosu",
  "Coffee Machine Whisperer": "Kahve Makinesinin Dilinden Anlayan",
  "Reply-All Enthusiast": "Tümünü Yanıtla Tutkunu",
  "Meeting Survivor": "Toplantı Gazisi",
  "PowerPoint Picasso": "PowerPoint Picasso'su",
  "Desk Plant Parent": "Masa Çiçeği Bakıcısı",
  "Watercooler Diplomat": "Su Sebili Diplomatı",
  "BCC Ninja": "BCC Ninjası",
  "Inbox Zero Hero": "Boş Gelen Kutusu Kahramanı",
  // Hybrid / remote
  "Pajama Executive": "Pijamalı Yönetici",
  "Zoom Mute Master": "Sessize Alma Ustası",
  "Wi-Fi Nomad": "Wi-Fi Göçebesi",
  "Sofa Surfer": "Kanepe Sörfçüsü",
  "Virtual Background Artist": "Sanal Arka Plan Sanatçısı",
  "Keyboard Cat": "Klavye Kedisi",
  "Timezone Traveler": "Saat Dilimi Gezgini",
  "Screen Share Strategist": "Ekran Paylaşım Stratejisti",
  "Webcam Avoider": "Kamera Kaçkını",
  "Router Rebooter": "Modem Resetçisi",
  // Service
  "Customer Whisperer": "Müşterinin Dilinden Anlayan",
  "Smile Ambassador": "Gülümseme Elçisi",
  "Patience Practitioner": "Sabır Taşı",
  "Receipt Magician": "Fiş Sihirbazı",
  "The Floor General": "Salonun Generali",
  "Karen's Nemesis": "Huysuz Müşterinin Kâbusu",
  "Shift Survivor": "Vardiya Gazisi",
  "Name Tag Ninja": "Yaka Kartı Ninjası",
  "The Apology Artist": "Özür Sanatçısı",
  "Small Talk Specialist": "Ayaküstü Sohbet Uzmanı",
  // Manual labour
  "Heavy Lifter Extraordinaire": "Ağır Yük Şampiyonu",
  "The Toolbox Tamer": "Alet Çantası Terbiyecisi",
  "Forklift Philosopher": "Forklift Filozofu",
  "Callus Collector": "Nasır Koleksiyoncusu",
  "Hard Hat Hero": "Baretli Kahraman",
  "Duct Tape Magician": "Koli Bandı Sihirbazı",
  "The Blueprint Boss": "Teknik Çizim Patronu",
  "Steel Toe Sprinter": "Çelik Burunlu Koşucu",
  "WD-40 Wizard": "WD-40 Büyücüsü",
  "Early Morning Engine": "Erkenci Motor",
};

export default usernames;
