import type { CategoryKey, WorkplaceType } from "@iwtr/shared-types";

/**
 * The words the company Summary is built from (2026-10-25), in English and
 * Turkish. Every survey question (survey-questions.data.ts) has two short
 * noun phrases: what reviewers praise when most give the healthy answer,
 * and what they complain about when most don't. They are written to slot
 * into the sentence frames below unchanged - in Turkish always in the plain
 * (nominative) form, so no suffix ever has to be glued onto them.
 *
 * Wording rules (as for the Vibe Flags): the text reports what reviewers
 * say, never a legal finding. No "illegal", no crime named; a pay or safety
 * problem is a complaint or a concern reviewers raise.
 *
 * Changing a question's meaning means changing its phrases here too.
 */

export type Lang = "en" | "tr";
export type Pair = Record<Lang, string>;

export interface QuestionPhrases {
  good: Pair;
  bad: Pair;
}

const p = (goodEn: string, goodTr: string, badEn: string, badTr: string): QuestionPhrases => ({
  good: { en: goodEn, tr: goodTr },
  bad: { en: badEn, tr: badTr },
});

export const QUESTION_PHRASES: Record<string, QuestionPhrases> = {
  // ---------------------------------------------------------------- OFFICE
  "OFFICE.corporateCulture.1": p("being judged on output, not desk hours", "masa başı saatleri değil, işin sonucunun ölçülmesi", "late hours rewarded over real output", "işin sonucu yerine geç saatlere kadar kalmanın ödüllendirilmesi"),
  "OFFICE.corporateCulture.2": p("promotions earned on merit", "liyakate dayalı terfiler", "favouritism in promotions", "terfilerde kayırmacılık"),
  "OFFICE.corporateCulture.3": p("freedom to question decisions openly", "kararları açıkça sorgulayabilme özgürlüğü", "fear of speaking up in meetings", "toplantılarda fikir söylemekten çekinilmesi"),
  "OFFICE.corporateCulture.4": p("values that management actually lives by", "yönetimin söylediği değerlere gerçekten uyması", "values preached but not practised", "söylenen değerlerle uygulamanın uyuşmaması"),
  "OFFICE.corporateCulture.5": p("supportive teamwork and fair recognition", "destekleyici ekip çalışması ve adil takdir", "weak teamwork and little recognition", "zayıf ekip çalışması ve takdir eksikliği"),
  "OFFICE.leadership.1": p("room to work without micromanagement", "mikro yönetim olmadan çalışabilme alanı", "constant micromanagement", "sürekli mikro yönetim"),
  "OFFICE.leadership.2": p("managers who own their mistakes", "hatalarını üstlenen yöneticiler", "blame pushed down onto staff", "hataların faturasının çalışanlara kesilmesi"),
  "OFFICE.leadership.3": p("clear, useful feedback", "net ve işe yarar geri bildirim", "vague, unhelpful feedback", "belirsiz ve işe yaramayan geri bildirim"),
  "OFFICE.leadership.4": p("decisions explained before they land", "kararların uygulanmadan önce açıklanması", "decisions announced without warning", "kararların habersizce duyurulması"),
  "OFFICE.leadership.5": p("managers who shield the team from overload", "ekibi aşırı iş yükünden koruyan yöneticiler", "sudden workload spikes from above", "yukarıdan gelen ani iş yükü artışları"),
  "OFFICE.infrastructure.1": p("reliable computers and software", "sorunsuz çalışan bilgisayar ve yazılımlar", "slow, outdated computers and software", "yavaş ve eskimiş bilgisayar ve yazılımlar"),
  "OFFICE.infrastructure.2": p("a quiet office that lets you focus", "odaklanmaya izin veren sakin bir ofis", "a noisy office that breaks focus", "odaklanmayı zorlaştıran gürültülü bir ofis"),
  "OFFICE.infrastructure.3": p("well-kept supplies and meeting rooms", "bakımlı malzemeler ve toplantı odaları", "neglected supplies and meeting rooms", "bakımsız malzemeler ve toplantı odaları"),
  "OFFICE.infrastructure.4": p("clear internal documentation", "net bir iç dokümantasyon", "missing internal documentation", "eksik iç dokümantasyon"),
  "OFFICE.infrastructure.5": p("fast IT support", "hızlı BT desteği", "slow IT support", "yavaş BT desteği"),
  "OFFICE.workLifeBalance.1": p("evenings free of work messages", "mesai dışında iş mesajı gelmemesi", "work messages after hours", "mesai dışında gelen iş mesajları"),
  "OFFICE.workLifeBalance.2": p("overtime that is paid", "ücreti ödenen fazla mesai", "unpaid overtime", "ücretsiz fazla mesai"),
  "OFFICE.workLifeBalance.3": p("leave that is truly left alone", "izindeyken rahatsız edilmemek", "work calls during leave", "izindeyken gelen iş aramaları"),
  "OFFICE.workLifeBalance.4": p("flexibility for personal appointments", "kişisel randevular için esneklik", "little flexibility for appointments", "kişisel randevulara esneklik tanınmaması"),
  "OFFICE.workLifeBalance.5": p("results valued over online status", "çevrim içi durumdan çok sonuçlara bakılması", "seat time and status icons being watched", "masa başı süresinin ve çevrim içi durumun izlenmesi"),
  "OFFICE.stability.1": p("openness about team changes", "ekip değişiklikleri konusunda açıklık", "silence about team changes", "ekip değişikliklerinin gizli tutulması"),
  "OFFICE.stability.2": p("a steady strategic direction", "istikrarlı bir strateji", "frequent changes of direction", "sık sık değişen strateji"),
  "OFFICE.stability.3": p("salary reviews on a set schedule", "düzenli takvime bağlı maaş değerlendirmeleri", "unpredictable salary reviews", "ne zaman yapılacağı belirsiz maaş değerlendirmeleri"),
  "OFFICE.stability.4": p("real support for career growth", "kariyer gelişimine gerçek destek", "little investment in career growth", "kariyer gelişimine yatırım yapılmaması"),
  "OFFICE.stability.5": p("confidence in long-term job security", "uzun vadeli iş güvencesine duyulan güven", "worries about job security", "iş güvencesine dair endişeler"),

  // --------------------------------------------------------- HYBRID_REMOTE
  "HYBRID_REMOTE.corporateCulture.1": p("trust without tracking software", "takip yazılımı olmadan duyulan güven", "monitoring and tracking software", "izleme ve takip yazılımları"),
  "HYBRID_REMOTE.corporateCulture.2": p("equal treatment for remote staff", "uzaktan çalışanlara eşit davranılması", "office staff favoured over remote staff", "ofistekilerin uzaktan çalışanlara tercih edilmesi"),
  "HYBRID_REMOTE.corporateCulture.3": p("respect for replying in your own time", "yanıt için zaman tanınmasına saygı", "pressure to reply instantly", "anında yanıt verme baskısı"),
  "HYBRID_REMOTE.corporateCulture.4": p("respect for time zones", "saat dilimlerine saygı", "calls set outside your working hours", "çalışma saatleri dışına konan toplantılar"),
  "HYBRID_REMOTE.corporateCulture.5": p("social events that are truly optional", "gerçekten isteğe bağlı sosyal etkinlikler", "pressure to join social calls", "sosyal toplantılara katılma baskısı"),
  "HYBRID_REMOTE.leadership.1": p("performance judged on outcomes", "performansın sonuçlara göre değerlendirilmesi", "performance judged by online status", "performansın çevrim içi duruma göre ölçülmesi"),
  "HYBRID_REMOTE.leadership.2": p("focused, well-run meetings", "odaklı ve iyi yönetilen toplantılar", "long meetings without agendas", "gündemsiz ve uzayan toplantılar"),
  "HYBRID_REMOTE.leadership.3": p("managers who reply in good time", "zamanında yanıt veren yöneticiler", "managers who are hard to reach", "ulaşılması zor yöneticiler"),
  "HYBRID_REMOTE.leadership.4": p("leaders who act on signs of burnout", "tükenmişlik belirtilerine önem veren yöneticiler", "burnout left unaddressed", "görmezden gelinen tükenmişlik"),
  "HYBRID_REMOTE.leadership.5": p("honest updates from leadership", "yönetimden dürüst bilgilendirme", "vague or evasive leadership updates", "belirsiz ve kaçamak yönetim açıklamaları"),
  "HYBRID_REMOTE.infrastructure.1": p("good equipment for the home setup", "evden çalışma için iyi ekipman", "no support for the home setup", "evden çalışma düzenine destek verilmemesi"),
  "HYBRID_REMOTE.infrastructure.2": p("fast, reliable remote tools", "hızlı ve güvenilir uzaktan çalışma araçları", "slow or unreliable remote tools", "yavaş ya da güvenilmez uzaktan çalışma araçları"),
  "HYBRID_REMOTE.infrastructure.3": p("documentation good enough to work alone", "tek başına çalışmaya yetecek dokümantasyon", "documentation too thin to rely on", "güvenilemeyecek kadar eksik dokümantasyon"),
  "HYBRID_REMOTE.infrastructure.4": p("quick remote IT help", "hızlı uzaktan BT desteği", "long waits for IT help", "BT desteği için uzun bekleyişler"),
  "HYBRID_REMOTE.infrastructure.5": p("well-organised collaboration tools", "düzenli işbirliği araçları", "chaotic collaboration tools", "dağınık işbirliği araçları"),
  "HYBRID_REMOTE.workLifeBalance.1": p("a clear line between work and home", "iş ile özel hayat arasında net bir çizgi", "workdays spilling into unpaid hours", "ücretsiz saatlere taşan iş günleri"),
  "HYBRID_REMOTE.workLifeBalance.2": p("freedom to step away from the screen", "ekrandan rahatça uzaklaşabilme", "anxiety about the status icon", "çevrim içi durum simgesi kaygısı"),
  "HYBRID_REMOTE.workLifeBalance.3": p("a real right to disconnect", "gerçek bir bağlantıyı kesme hakkı", "no real right to disconnect", "bağlantıyı kesme hakkının tanınmaması"),
  "HYBRID_REMOTE.workLifeBalance.4": p("a workload that fits the week", "haftaya sığan bir iş yükü", "a workload too big for the week", "haftaya sığmayan bir iş yükü"),
  "HYBRID_REMOTE.workLifeBalance.5": p("office days that have a purpose", "amacı olan ofis günleri", "pointless mandatory office days", "anlamsız zorunlu ofis günleri"),
  "HYBRID_REMOTE.stability.1": p("a settled remote policy", "oturmuş bir uzaktan çalışma politikası", "talk of a forced return to the office", "ofise zorunlu dönüş söylentileri"),
  "HYBRID_REMOTE.stability.2": p("equal pay for remote staff", "uzaktan çalışanlara eşit ücret", "lower pay for remote staff", "uzaktan çalışanlara daha düşük ücret"),
  "HYBRID_REMOTE.stability.3": p("equal access to mentoring and promotion", "mentorluk ve terfiye eşit erişim", "remote staff passed over for promotion", "terfilerde uzaktan çalışanların geri planda kalması"),
  "HYBRID_REMOTE.stability.4": p("clear goals and expectations", "net hedefler ve beklentiler", "unclear goals and expectations", "belirsiz hedefler ve beklentiler"),
  "HYBRID_REMOTE.stability.5": p("confidence that remote roles will last", "uzaktan çalışma pozisyonlarının kalıcı olduğuna duyulan güven", "fear of roles being cut or offshored", "pozisyonların kaldırılacağı ya da yurt dışına taşınacağı endişesi"),

  // --------------------------------------------------------------- SERVICE
  "SERVICE.corporateCulture.1": p("managers who back staff against rude customers", "kaba müşterilere karşı çalışanını koruyan yöneticiler", "staff left alone with abusive customers", "saldırgan müşterilerle yalnız bırakılan çalışanlar"),
  "SERVICE.corporateCulture.2": p("a supportive team on the floor", "destekleyici bir çalışma ortamı", "a competitive, tense floor", "rekabetçi ve gergin bir çalışma ortamı"),
  "SERVICE.corporateCulture.3": p("realistic service targets", "gerçekçi hız hedefleri", "speed targets that push shortcuts", "kestirme yollara iten hız hedefleri"),
  "SERVICE.corporateCulture.4": p("fairly shared shifts and weekends", "adil dağıtılan vardiyalar ve hafta sonları", "unfair shift and weekend assignments", "adaletsiz vardiya ve hafta sonu dağılımı"),
  "SERVICE.corporateCulture.5": p("hard work that gets recognised", "emeğin takdir edilmesi", "hard work that goes unnoticed", "emeğin görmezden gelinmesi"),
  "SERVICE.leadership.1": p("supervisors who don't play favourites", "kayırmacılık yapmayan vardiya amirleri", "supervisors playing favourites", "kayırmacılık yapan vardiya amirleri"),
  "SERVICE.leadership.2": p("managers who help out at rush hour", "yoğun saatlerde yardıma gelen yöneticiler", "managers missing at rush hour", "yoğun saatlerde ortada olmayan yöneticiler"),
  "SERVICE.leadership.3": p("the same rules for everyone", "herkese aynı kurallar", "double standards in the rules", "kurallarda çifte standart"),
  "SERVICE.leadership.4": p("quick action on harassment reports", "taciz şikâyetlerine hızlı müdahale", "harassment reports not acted on", "taciz şikâyetlerinin karşılıksız kalması"),
  "SERVICE.leadership.5": p("managers who listen to the floor", "çalışanları dinleyen yöneticiler", "front-line warnings ignored", "sahadan gelen uyarıların dikkate alınmaması"),
  "SERVICE.infrastructure.1": p("equipment that holds up when it's busy", "yoğunlukta aksamayan ekipman", "registers and equipment failing when busy", "yoğunlukta çöken kasa ve ekipman"),
  "SERVICE.infrastructure.2": p("clean, private break areas", "temiz ve müşteriden ayrı dinlenme alanları", "poor or shared break areas", "bakımsız ya da müşteriyle ortak dinlenme alanları"),
  "SERVICE.infrastructure.3": p("well-stocked supplies", "eksiksiz stok ve malzeme", "frequent stock shortages", "sık yaşanan stok eksikleri"),
  "SERVICE.infrastructure.4": p("safety and security taken seriously", "ciddiye alınan güvenlik önlemleri", "lax safety and security", "gevşek güvenlik önlemleri"),
  "SERVICE.infrastructure.5": p("rest breaks that are actually given", "gerçekten verilen dinlenme molaları", "rest breaks skipped on busy shifts", "yoğun vardiyalarda atlanan molalar"),
  "SERVICE.workLifeBalance.1": p("schedules posted well in advance", "önceden açıklanan çalışma programları", "schedules posted at the last minute", "son dakikada açıklanan programlar"),
  "SERVICE.workLifeBalance.2": p("days off that stay days off", "gerçekten izin olarak kalan izin günleri", "pressure to work on days off", "izin günlerinde çalışma baskısı"),
  "SERVICE.workLifeBalance.3": p("no close-then-open shifts", "kapanış-açılış vardiyalarının olmaması", "closing late and opening early", "geç kapanış ardından erken açılış vardiyaları"),
  "SERVICE.workLifeBalance.4": p("overtime that is truly voluntary", "gerçekten isteğe bağlı fazla mesai", "overtime forced at short notice", "son dakika dayatılan fazla mesai"),
  "SERVICE.workLifeBalance.5": p("respect for life outside work", "iş dışındaki hayata saygı", "little respect for personal plans", "kişisel planlara saygı gösterilmemesi"),
  "SERVICE.stability.1": p("clearly explained pay and overtime", "açıkça hesaplanan maaş ve fazla mesai", "unclear pay and overtime calculations", "belirsiz maaş ve fazla mesai hesapları"),
  "SERVICE.stability.2": p("tips and bonuses paid accurately", "doğru ödenen bahşiş ve primler", "concerns about tips and bonuses", "bahşiş ve primlerle ilgili şikâyetler"),
  "SERVICE.stability.3": p("a well-staffed team", "yeterli personelle çalışan bir ekip", "constant understaffing and turnover", "sürekli eksik personel ve yüksek devir hızı"),
  "SERVICE.stability.4": p("a real path to supervisor roles", "amirliğe uzanan gerçek bir yol", "no clear path to promotion", "belirsiz bir terfi yolu"),
  "SERVICE.stability.5": p("confidence in long-term job security", "uzun vadeli iş güvencesine duyulan güven", "worries about job security", "iş güvencesine dair endişeler"),

  // --------------------------------------------------------- MANUAL_LABOUR
  "MANUAL_LABOUR.corporateCulture.1": p("safety put before speed", "hızdan önce gelen iş güvenliği", "speed put before safety", "güvenliğin önüne geçen hız baskısı"),
  "MANUAL_LABOUR.corporateCulture.2": p("a site free of hazing", "zorbalık ve tacizden uzak bir iş yeri", "reports of hazing on site", "sahada zorbalık şikâyetleri"),
  "MANUAL_LABOUR.corporateCulture.3": p("respect for workers' rights and safety rules", "işçi haklarına ve güvenlik kurallarına saygı", "workers' rights and safety rules overlooked", "işçi haklarının ve güvenlik kurallarının göz ardı edilmesi"),
  "MANUAL_LABOUR.corporateCulture.4": p("fair support for injured workers", "yaralanan işçilere adil destek", "injured workers fearing for their jobs", "işini kaybetmekten korkan yaralı işçiler"),
  "MANUAL_LABOUR.corporateCulture.5": p("a crew that works as a team", "takım olarak çalışan bir ekip", "a crew pitted against each other", "birbirine karşı yarıştırılan bir ekip"),
  "MANUAL_LABOUR.leadership.1": p("foremen with real hands-on experience", "sahada gerçek deneyimi olan ustabaşılar", "foremen without hands-on experience", "saha deneyimi olmayan ustabaşılar"),
  "MANUAL_LABOUR.leadership.2": p("heavy work shared fairly", "adil paylaştırılan ağır işler", "the hardest jobs landing on the same people", "en ağır işlerin hep aynı kişilere verilmesi"),
  "MANUAL_LABOUR.leadership.3": p("managers who follow their own safety rules", "kendi koyduğu güvenlik kurallarına uyan yöneticiler", "managers who skip their own safety rules", "kendi güvenlik kurallarına uymayan yöneticiler"),
  "MANUAL_LABOUR.leadership.4": p("hazards fixed as soon as they're reported", "bildirilir bildirilmez giderilen tehlikeler", "reported hazards left unfixed", "bildirildiği hâlde giderilmeyen tehlikeler"),
  "MANUAL_LABOUR.leadership.5": p("practical safety briefings", "işe yarar güvenlik brifingleri", "box-ticking safety briefings", "göstermelik güvenlik brifingleri"),
  "MANUAL_LABOUR.infrastructure.1": p("well-serviced machines and tools", "bakımlı makine ve aletler", "poorly maintained machines and tools", "bakımsız makine ve aletler"),
  "MANUAL_LABOUR.infrastructure.2": p("free protective equipment", "ücretsiz verilen koruyucu ekipman", "gaps in protective equipment", "koruyucu ekipman eksikleri"),
  "MANUAL_LABOUR.infrastructure.3": p("water, shade and toilets on site", "sahada su, gölgelik ve tuvalet", "missing water, shade or toilets", "su, gölgelik ya da tuvalet eksikliği"),
  "MANUAL_LABOUR.infrastructure.4": p("materials delivered on time", "zamanında gelen malzemeler", "late materials and risky workarounds", "geciken malzemeler ve riskli geçici çözümler"),
  "MANUAL_LABOUR.infrastructure.5": p("well-stocked first aid kits", "eksiksiz ilk yardım malzemeleri", "poorly stocked first aid kits", "eksik ilk yardım malzemeleri"),
  "MANUAL_LABOUR.workLifeBalance.1": p("reasonable shift lengths", "makul vardiya süreleri", "exhausting shift lengths", "yorucu vardiya süreleri"),
  "MANUAL_LABOUR.workLifeBalance.2": p("freedom to turn down overtime", "fazla mesaiyi reddedebilme özgürlüğü", "overtime you can't refuse", "reddedilemeyen fazla mesai"),
  "MANUAL_LABOUR.workLifeBalance.3": p("water and rest breaks that are kept", "aksatılmayan su ve dinlenme molaları", "skipped water and rest breaks", "atlanan su ve dinlenme molaları"),
  "MANUAL_LABOUR.workLifeBalance.4": p("paid travel to distant sites", "uzak sahalara gidişte ödenen yol süresi", "unpaid travel to distant sites", "ücreti ödenmeyen yol süreleri"),
  "MANUAL_LABOUR.workLifeBalance.5": p("enough recovery time between shifts", "vardiyalar arasında yeterli dinlenme", "too little recovery between shifts", "vardiyalar arasında yetersiz dinlenme"),
  "MANUAL_LABOUR.stability.1": p("accurate pay, on time", "eksiksiz ve zamanında ödenen maaş", "concerns about late or short pay", "geciken ya da eksik ödemelerle ilgili şikâyetler"),
  "MANUAL_LABOUR.stability.2": p("steady, predictable hours", "düzenli ve öngörülebilir çalışma saatleri", "unpredictable hours through the year", "yıl içinde değişken çalışma saatleri"),
  "MANUAL_LABOUR.stability.3": p("paid training and certifications", "işverence karşılanan eğitim ve sertifikalar", "no paid training or certifications", "eğitim ve sertifikaya destek verilmemesi"),
  "MANUAL_LABOUR.stability.4": p("incident reports handled promptly", "zamanında işlenen kaza bildirimleri", "slow handling of incident reports", "kaza bildirimlerinin geciktirilmesi"),
  "MANUAL_LABOUR.stability.5": p("a pace you can keep up for years", "yıllarca sürdürülebilecek bir tempo", "a pace that wears people down", "insanı yıpratan bir tempo"),
};

/**
 * Score band, from the Rating Breakdown's overall average: 1 (under 2.0),
 * 2 (2.0-2.9), 3 (3.0-3.9), 4 (4.0 and up). The summary is written for its
 * band and only rewritten when the company moves into another one.
 */
export type ScoreBand = 1 | 2 | 3 | 4;

export const OPENINGS: Record<WorkplaceType, Record<ScoreBand, Pair>> = {
  OFFICE: {
    4: { en: "Reviewers paint a well-run office that most of them would recommend.", tr: "Değerlendirenler, çoğunun tavsiye edeceği iyi yönetilen bir ofis anlatıyor." },
    3: { en: "Reviewers describe a decent office with clear strengths and a few real drawbacks.", tr: "Değerlendirenler, belirgin güçlü yanları ve birkaç gerçek eksiği olan makul bir ofis anlatıyor." },
    2: { en: "Reviewers describe an office with more frustrations than strengths.", tr: "Değerlendirenler, güçlü yanlarından çok sıkıntıları öne çıkan bir ofis anlatıyor." },
    1: { en: "Reviewers describe a difficult office where most of them would not stay.", tr: "Değerlendirenler, çoğunun kalmak istemeyeceği zor bir ofis ortamı anlatıyor." },
  },
  HYBRID_REMOTE: {
    4: { en: "Remote and hybrid staff describe a team that trusts them and works well at a distance.", tr: "Uzaktan ve hibrit çalışanlar, kendilerine güvenen ve mesafeye rağmen iyi işleyen bir ekip anlatıyor." },
    3: { en: "Remote and hybrid staff describe a workable setup with some rough edges.", tr: "Uzaktan ve hibrit çalışanlar, bazı pürüzleri olan ama işleyen bir düzen anlatıyor." },
    2: { en: "Remote and hybrid staff describe a setup that often works against them.", tr: "Uzaktan ve hibrit çalışanlar, çoğu zaman aleyhlerine işleyen bir düzen anlatıyor." },
    1: { en: "Remote and hybrid staff describe a setup where they feel watched and unsupported.", tr: "Uzaktan ve hibrit çalışanlar, kendilerini izlenen ve desteksiz hissettikleri bir düzen anlatıyor." },
  },
  SERVICE: {
    4: { en: "Staff describe a well-run workplace where people are treated fairly.", tr: "Çalışanlar, insanlara adil davranılan ve iyi yönetilen bir işletme anlatıyor." },
    3: { en: "Staff describe a busy but manageable workplace with a few sore points.", tr: "Çalışanlar, yoğun ama idare edilebilir, birkaç sıkıntılı noktası olan bir işletme anlatıyor." },
    2: { en: "Staff describe a demanding workplace where the problems outweigh the positives.", tr: "Çalışanlar, sorunların olumlu yanlara ağır bastığı yorucu bir işletme anlatıyor." },
    1: { en: "Staff describe a hard place to work, with little support on the floor.", tr: "Çalışanlar, sahada çok az destek gördükleri, çalışması zor bir yer anlatıyor." },
  },
  MANUAL_LABOUR: {
    4: { en: "Workers describe a well-run site where safety and people come first.", tr: "Çalışanlar, güvenliğin ve insanın önce geldiği, iyi yönetilen bir iş yeri anlatıyor." },
    3: { en: "Workers describe a solid site with a few things that need fixing.", tr: "Çalışanlar, düzeltilmesi gereken birkaç konusu olan sağlam bir iş yeri anlatıyor." },
    2: { en: "Workers describe a tough site where problems come up often.", tr: "Çalışanlar, sorunların sık yaşandığı zorlu bir iş yeri anlatıyor." },
    1: { en: "Workers describe a draining site with serious, recurring complaints.", tr: "Çalışanlar, ciddi ve tekrar eden şikâyetlerin olduğu yıpratıcı bir iş yeri anlatıyor." },
  },
};

/** Category names as they sit in the "strongest / weakest area" sentence. */
export const CATEGORY_NAMES: Record<CategoryKey, Pair> = {
  corporateCulture: { en: "corporate culture", tr: "kurum kültürü" },
  leadership: { en: "leadership", tr: "liderlik ve yönetim" },
  infrastructure: { en: "infrastructure", tr: "altyapı ve imkânlar" },
  workLifeBalance: { en: "work-life balance", tr: "iş ve sosyal hayat dengesi" },
  stability: { en: "stability", tr: "kurumsal istikrar" },
};

/**
 * The closing line: practical advice aimed at the weakest area. From band 3
 * up it is a tip after a short verdict; below that, a plain warning.
 */
export const ADVICE: Record<CategoryKey, { tip: Pair; warn: Pair }> = {
  corporateCulture: {
    tip: { en: "ask how decisions and promotions are made.", tr: "kararların ve terfilerin nasıl verildiğini sormakta fayda var." },
    warn: { en: "If you apply, ask current staff how people are treated day to day.", tr: "Başvuracaksan, mevcut çalışanlara günlük hayatta insanlara nasıl davranıldığını sor." },
  },
  leadership: {
    tip: { en: "try to meet your future manager before you accept.", tr: "teklifi kabul etmeden önce müstakbel yöneticini tanımaya çalış." },
    warn: { en: "Before accepting, find out who you would report to and how they manage.", tr: "Kabul etmeden önce kime bağlı çalışacağını ve nasıl yönettiğini öğren." },
  },
  infrastructure: {
    tip: { en: "check the tools and equipment you would be given.", tr: "sana verilecek araç ve ekipmanı önceden sor." },
    warn: { en: "Ask to see the tools, equipment and conditions before you start.", tr: "Başlamadan önce araçları, ekipmanı ve çalışma koşullarını görmek iste." },
  },
  workLifeBalance: {
    tip: { en: "agree working hours and overtime rules in writing.", tr: "çalışma saatlerini ve fazla mesai kurallarını yazılı olarak netleştir." },
    warn: { en: "If you join, set firm boundaries and get hours and overtime in writing.", tr: "Katılırsan sınırlarını net koy; çalışma saatlerini ve fazla mesaiyi yazılı al." },
  },
  stability: {
    tip: { en: "ask about pay reviews and where the role can lead.", tr: "maaş artışlarını ve pozisyonun nereye uzanabileceğini sor." },
    warn: { en: "Ask about pay, contracts and job security before you commit.", tr: "Karar vermeden önce maaşı, sözleşmeyi ve iş güvencesini sor." },
  },
};

/** The short verdict in front of a tip: "A strong option; ask how ...". */
export const TIP_LEAD: Record<3 | 4, Pair> = {
  4: { en: "A strong option; ", tr: "Güçlü bir seçenek; " },
  3: { en: "Worth considering; ", tr: "Değerlendirmeye değer; " },
};
