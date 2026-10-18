// Turkish wording for the CV, References, Certificates and the chat window's
// newer controls. Same rules as the other files: key = the English text in
// the component, value = the Turkish (Kariyer.net wording where it exists).
const cv: Record<string, string> = {
  // Edit Profile tabs
  "References": "Referanslar",

  // References
  "People from your past jobs who can speak for your work. They appear on your CV, nowhere else on the site.":
    "Önceki işlerinden, çalışmanı anlatabilecek kişiler. Yalnızca CV'nde görünürler, sitenin başka hiçbir yerinde görünmezler.",
  "No references yet.": "Henüz referans eklemedin.",
  "Add reference": "Referans ekle",
  "Position at the company": "Firmadaki pozisyonu",
  "Pick their position": "Pozisyonunu seç",
  "Email address": "E-posta adresi",
  "name.surname@gmail.com": "isim.soyisim@gmail.com",
  "Add at least an email address or a phone number. Ask your reference first: their details are printed on the CV you send to employers.":
    "En az bir e-posta adresi veya telefon numarası ekle. Önce referansına sor: bilgileri, işverenlere gönderdiğin CV'de yer alır.",
  "Add an email address or a phone number, so an employer can reach this reference.":
    "İşverenin bu referansa ulaşabilmesi için bir e-posta adresi veya telefon numarası ekle.",
  "Enter a valid phone number.": "Geçerli bir telefon numarası gir.",
  "Enter a valid email address.": "Geçerli bir e-posta adresi gir.",
  "You can add up to 5 references.": "En fazla 5 referans ekleyebilirsin.",
  "Reference not found": "Referans bulunamadı",
  // Only ever used inside "Please check your {label}.", hence the object case.
  "first name": "adı",
  "last name": "soyadı",
  "position": "pozisyonu",
  "email address": "e-posta adresini",
  "phone number": "telefon numarasını",

  // Certificates
  "Certificates": "Sertifikalar",
  "Certificate name": "Sertifika adı",
  "e.g. Digital Marketing Certificate": "Örn: Dijital Pazarlama Sertifikası",
  "Pick one from the list, or type yours if it isn't there.": "Listeden seç ya da listede yoksa kendin yaz.",
  "Issuing organisation": "Düzenleyen kurum",
  "e.g. Istanbul University": "Örn: İstanbul Üniversitesi",
  "Certificate date": "Sertifika tarihi",
  "optional": "isteğe bağlı",
  "Share the details of your certificates and qualifications here.":
    "Bu alanda sahip olduğun sertifikaları ve uzmanlık belgelerinin detaylarını paylaşabilirsin.",
  "Add certificate": "Sertifika ekle",
  "Saved one by one, and shown on your CV.": "Her biri ayrı kaydedilir ve CV'nde görünür.",
  "Enter the certificate's name.": "Sertifikanın adını gir.",
  "Enter who issued it.": "Sertifikayı düzenleyen kurumu gir.",
  "Use 120 characters or fewer.": "En fazla 120 karakter kullan.",
  "Pick the month and year.": "Ay ve yılı seç.",
  "You can add up to 15 certificates.": "En fazla 15 sertifika ekleyebilirsin.",
  "Certificate not found": "Sertifika bulunamadı",
  "certificate name": "sertifika adını",
  "issuing organisation": "düzenleyen kurumu",
  "certificate date": "sertifika tarihini",

  // My CV tab
  "Built from your profile. This is what an employer receives when you press Apply.":
    "Profilinden oluşturulur. Başvur'a bastığında işverene giden CV budur.",
  "CV photo": "CV fotoğrafı",
  "Your photo is only shown on the CV that is sent to the jobs you apply for. It never appears anywhere else on the site: your reviews and comments keep your anonymous avatar.":
    "Fotoğrafın yalnızca başvurduğun ilanlara gönderilen CV'de görünür. Sitenin başka hiçbir yerinde görünmez: değerlendirmelerin ve yorumların anonim avatarınla kalır.",
  "What's on your CV": "CV'nde neler var",
  "Profile summary": "Profil özeti",
  "Full screen": "Tam ekran",
  "Download PDF": "PDF indir",
  "Preparing...": "Hazırlanıyor...",
  "Couldn't make the PDF. Please try again.": "PDF oluşturulamadı. Lütfen tekrar dene.",

  // The CV document
  "Profile": "Profil",
  "Experience": "İş deneyimi",
  "Details": "Bilgiler",
  "Born": "Doğum yılı",
  "Kind of work": "Çalışma şekli",
  "Skills": "Yetenekler",
  "Phone": "Telefon",

  // Chat window
  "Make conversation bigger": "Sohbeti büyüt",
  "Make conversation smaller": "Sohbeti küçült",
  "Enter to send, Shift + Enter for a new line": "Göndermek için Enter, yeni satır için Shift + Enter",
};

export default cv;
