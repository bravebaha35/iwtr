// Turkish for the rating survey's 100 questions (question set v2,
// 2026-10-24), from the owner's own Turkish, proofread: typos fixed,
// "üst terfi" (promotion) written as "yönetici", and either/or questions
// turned into yes/no ones. The survey speaks to the reviewer formally ("siz",
// the owner's choice on 2026-10-25), unlike the informal "sen" of the rest of
// the site. Keyed by the English text in apps/api's survey-questions.data.ts -
// change both together.
const survey: Record<string, string> = {
  "Is staying late or sitting at your desk past official hours rewarded over actual work output?":
    "Geç saatlere kadar kalmanız veya mesai saatleri dışında masanızda oturmanız, gerçek iş verimliliğinden daha mı değerli görülüyor?",
  "Have you personally witnessed office politics or favoritism dictate promotions over merit?":
    "Terfiler liyakat yerine ofis siyaseti veya kayırmacılıkla mı belirleniyor?",
  "Can employees openly criticize company decisions in meetings without fear of retaliation?":
    "Çalışanlar toplantılarda şirket kararlarını, misilleme korkusu olmadan rahatça eleştirebiliyor mu?",
  "Does company management actually practice the corporate values they preach publicly?":
    "Şirket yönetimi, dile getirdiği kurumsal değerleri gerçekten uyguluyor mu?",
  "Is team collaboration supportive and is individual work appropriately recognized?":
    "Ekipler destekleyici bir iş birliği içinde çalışıyor ve bireysel emeğe gereken değer veriliyor mu?",
  "Does middle management actively micromanage your daily tasks?":
    "Bir üst yöneticiniz, günlük işlerinizi inciğine cıncığına kadar denetliyor mu?",
  "When a project fails, do leaders take responsibility instead of blaming subordinates?":
    "Bir proje başarısız olduğunda yöneticiler, ekiptekileri suçlamak yerine sorumluluğu üstleniyor mu?",
  "Do managers provide actionable, constructive feedback rather than vague performance reviews?":
    "Yöneticiler, belirsiz performans değerlendirmeleri yerine yapıcı ve uygulanabilir geri bildirim veriyor mu?",
  "Are major leadership decisions communicated transparently before taking effect?":
    "Önemli yönetim kararları, uygulamaya girmeden önce çalışanlara açıkça iletiliyor mu?",
  "Does your direct manager protect you from unreasonable workload spikes from executives?":
    "Doğrudan yöneticiniz, üst yönetimden gelen ani iş yüklerini size paslamak yerine kendisi göğüslüyor mu?",
  "Is your daily work frequently delayed by outdated computer hardware or slow software?":
    "İşiniz, eski bilgisayarlar veya yavaş yazılımlar yüzünden sık sık aksıyor mu?",
  "Is the physical office environment quiet and comfortable enough for deep focus?":
    "Çalıştığınız ofis, odaklanabilmeniz için yeterince sessiz ve rahat mı?",
  "Are basic office supplies and meeting room equipment consistently maintained?":
    "Temel ofis malzemeleri ve toplantı odası ekipmanlarının bakımı düzenli olarak yapılıyor mu?",
  "Does a clear, centralized internal wiki or knowledge base exist for your team's processes?":
    "Ekibinizin süreçleri için açık ve merkezi bir iç bilgi kaynağı (wiki vb.) var mı?",
  "Does IT support resolve critical, work-blocking technical issues in a timely manner?":
    "IT desteği, işinizi engelleyen kritik sorunları zamanında çözüyor mu?",
  "Are you expected to read or respond to work messages outside of official working hours?":
    "Mesai saatleri dışında iş mesajlarına ve aramalarına yanıt vermeniz bekleniyor mu?",
  "Is uncompensated overtime regularly expected in your role?":
    "Ücreti ödenmeyen fazla mesai yapmanız düzenli olarak bekleniyor mu?",
  "Can you take fully approved PTO without being contacted about work tasks?":
    "Onaylanmış izin günlerinizde, iş konularıyla ilgili aranmadan izninizi kullanabiliyor musunuz?",
  "Does management allow flexibility for personal or medical appointments during the day?":
    "Yönetim, gün içindeki özel veya sağlık randevularınız için esneklik tanıyor mu?",
  "Does management track physical seat time or online status icons over actual deliverables?":
    "Yönetim, ortaya koyduğunuz işe değil de masada oturduğunuz süreye veya çevrimiçi görünmenize mi bakıyor?",
  "Has your department maintained clear transparency regarding team retention and organizational changes over the past 12 months?":
    "Departmanınız, son 12 ayda ekipten ayrılmalar ve kurumsal değişiklikler konusunda açık ve şeffaf davrandı mı?",
  "Does the company frequently change its strategic direction?":
    "Şirket, stratejik yönünü sık sık değiştiriyor mu?",
  "Are salary reviews and compensation adjustments conducted on a predictable schedule?":
    "Maaş değerlendirmeleri ve ücret düzenlemeleri öngörülebilir bir takvimle mi yapılıyor?",
  "Does the company actively fund career growth or internal job promotions?":
    "Şirket, çalışanlarının kariyer gelişimini ve şirket içi terfilerini destekliyor mu?",
  "Do you feel confident your job will still exist at this company 12 months from now?":
    "Bir yıl sonra bu şirketteki işinizin hâlâ var olacağına inanıyor musunuz?",
  "Does management trust remote employees without using digital tracking or surveillance software?":
    "Yönetim, uzaktan çalışanlara izleme veya takip yazılımları kullanmadan güvenebiliyor mu?",
  "Do in-office employees receive preferential treatment or faster promotions over remote staff?":
    "Ofiste çalışanlar, uzaktan çalışanlara göre ayrıcalıklı tutulup daha hızlı terfi alıyor mu?",
  "Does the company respect asynchronous communication, allowing time to reply without pressure?":
    "Şirket, mesajlara anında yanıt beklemek yerine size yanıt vermeniz için zaman tanıyor mu?",
  "Does management respect your local timezone boundaries when scheduling calls or assigning tasks?":
    "Yönetim, toplantı planlarken veya görev dağıtırken bulunduğunuz saat dilimine saygı gösteriyor mu?",
  "Is remote socialization purely optional without social penalties for non-attendance?":
    "Uzaktan yapılan sosyal etkinlikler, katılmayanlara herhangi bir yaptırım uygulanmadan tamamen isteğe bağlı mı?",
  "Does leadership evaluate your performance strictly by work outcomes rather than online activity dots?":
    "Şirket, performansınızı \"çevrimiçi\" sürenize göre değil, ortaya koyduğunuz işe göre mi değerlendiriyor?",
  "Are virtual team meetings run with clear agendas and kept within set time limits?":
    "Uzaktan toplantılar net bir gündemle ve belirlenen süre içinde mi yürütülüyor?",
  "Does your manager respond to messages and support requests within a reasonable timeframe?":
    "Yöneticiniz, mesajlarınıza ve destek taleplerinize makul bir sürede dönüyor mu?",
  "Does leadership actively step in when a remote employee shows clear signs of burnout?":
    "Uzaktan çalışan birinde belirgin tükenmişlik belirtileri görüldüğünde yönetim harekete geçiyor mu?",
  "Is company leadership honest and transparent during virtual meetings and written updates?":
    "Şirket yönetimi, uzaktan toplantılarda ve yazılı duyurularda dürüst ve şeffaf mı?",
  "Did the company provide a proper stipend or high-quality hardware for your remote setup?":
    "Şirket, uzaktan çalışma düzeniniz için yeterli bir ödenek veya kaliteli donanım sağladı mı?",
  "Are cloud tools, VPNs, and internal software reliable and fast to access?":
    "Bulut araçlarına, VPN'e ve şirket içi yazılımlara erişim güvenilir ve hızlı mı?",
  "Is internal company documentation clear enough for you to solve problems independently?":
    "Şirket içi belgeler, sorunları kendi başınıza çözebileceğiniz kadar açık ve ulaşılabilir mi?",
  "Can remote IT support fix account access or device issues without long delays?":
    "Uzaktan IT desteği, hesap erişimi veya cihaz sorunlarını uzun gecikmeler olmadan çözebiliyor mu?",
  "Are digital collaboration tools (Slack, Teams, Jira) structured logically rather than chaotic?":
    "Ortak kullanılan dijital araçlar (Slack, Teams, Jira vb.) dağınık değil de düzenli mi?",
  "Do the lines between your personal life and workday frequently blur into unpaid work hours?":
    "Özel hayatınızla iş gününüz arasındaki sınır, sık sık ücretsiz mesaiye dönüşecek kadar bulanıklaşıyor mu?",
  "Can you step away from your computer during the day without feeling anxious about your status icon?":
    "Gün içinde çevrimiçi durumunuz hakkında kaygılanmadan bilgisayarınızın başından kalkabiliyor musunuz?",
  "Does the company enforce a genuine \"right to disconnect\" after your working day ends?":
    "Şirket, mesainiz bittikten sonra size gerçek anlamda \"bağlantıyı kesme\" hakkı tanıyor mu?",
  "Is your assigned workload realistically manageable within a standard work week?":
    "Size verilen iş yükü, normal bir çalışma haftası içinde gerçekçi biçimde bitirilebilir mi?",
  "Are hybrid employees forced into mandatory in-office days that serve no practical purpose?":
    "Hibrit çalışanlar, hiçbir pratik amacı olmayan zorunlu ofis günlerine gelmeye zorlanıyor mu?",
  "Is there constant management talk or threats of forced Return-to-Office mandates?":
    "Yönetim sürekli olarak zorunlu ofise dönüşten bahsediyor veya bununla tehdit ediyor mu?",
  "Are remote employees paid equally compared to in-office peers in the same role?":
    "Uzaktan çalışanlara, aynı roldeki ofis çalışanlarıyla eşit ücret ödeniyor mu?",
  "Do fully remote workers have equal access to mentorship and career advancement?":
    "Tamamen uzaktan çalışanlar, mentorluk ve kariyer gelişimi fırsatlarından eşit şekilde yararlanabiliyor mu?",
  "Are high-level departmental goals and performance expectations communicated clearly to remote staff?":
    "Departmanın hedefleri ve performans beklentileri uzaktan çalışanlara net bir şekilde iletiliyor mu?",
  "Are you worried your remote role might be offshored or eliminated without warning?":
    "Uzaktan yaptığınız işin haber verilmeden yurt dışına kaydırılmasından veya tamamen kaldırılmasından endişe ediyor musunuz?",
  "Does management take the worker's side when dealing with abusive or aggressive customers?":
    "Yönetim, saldırgan veya kötü davranan müşterilere karşı çalışanının yanında duruyor mu?",
  "Is the working environment on the floor supportive rather than competitive or toxic?":
    "Çalışma ortamı, rekabetçi veya yıpratıcı olmaktan çok destekleyici mi?",
  "Are service speed targets set at realistic levels that don't force dangerous shortcuts?":
    "Hizmet hızı hedefleri, sizi tehlikeli kestirmelere zorlamayacak kadar gerçekçi mi?",
  "Are shift assignments and weekend duties distributed fairly without supervisor bias?":
    "Vardiyalar ve hafta sonu görevleri, amirlerin kayırmacılığı olmadan adil şekilde dağıtılıyor mu?",
  "Does management publicly acknowledge and reward hard work on the floor?":
    "Yönetim, sahada gösterilen emeği fark edip açıkça takdir ediyor ve ödüllendiriyor mu?",
  "Do shift supervisors play favorites when scheduling shifts or assigning tasks?":
    "Amirler vardiya ve görev planlarken kayırmacılık yapıyor mu?",
  "Do managers step onto the floor to help the team during peak busy hours?":
    "Yöneticiler, en yoğun saatlerde ekibe yardım etmek için sahaya iniyor mu?",
  "Are company policies enforced consistently across all employees without double standards?":
    "Şirket kuralları, çifte standart olmadan herkese aynı şekilde uygulanıyor mu?",
  "Does management act immediately when internal harassment or bullying is reported?":
    "Taciz veya zorbalık bildirildiğinde yönetim hemen harekete geçiyor mu?",
  "Does management listen and adjust when front-line workers point out operational problems?":
    "Yöneticiler, sahada çalışanların dile getirdiği operasyonel sorunları dinleyip gerekli düzenlemeleri yapıyor mu?",
  "Do POS systems, registers, or service equipment frequently crash during busy shifts?":
    "POS sistemi, kasa veya diğer servis ekipmanları yoğun saatlerde sık sık arızalanıyor mu?",
  "Are employee break areas clean, sanitary, and physically separate from customers?":
    "Çalışanların mola alanı temiz, hijyenik ve müşterilerden ayrı bir yerde mi?",
  "Is essential product inventory or operational supplies consistently stocked?":
    "Temel ürün stokları ve operasyonel malzemeler sürekli olarak mevcut mu?",
  "Are physical safety protocols and security measures strictly maintained on site?":
    "İş yerinde fiziksel güvenlik kuralları ve önlemleri sıkı bir şekilde uygulanıyor mu?",
  "Are mandatory rest breaks consistently granted during intense shifts?":
    "Yoğun vardiyalarda zorunlu dinlenme molaları aksatılmadan veriliyor mu?",
  "Are work schedules posted at least two weeks in advance?":
    "Çalışma programları en az iki hafta önceden ilan ediliyor mu?",
  "Are you repeatedly pressured to cover shifts on your scheduled days off?":
    "Planlanmış izin günlerinizde başkasının vardiyasını üstlenmeniz için sık sık baskı görüyor musunuz?",
  "Does management avoid scheduling \"clopening\" shifts (closing late and opening early next morning)?":
    "Yönetim, \"kapanış-açılış\" vardiyaları (gece geç kapatıp ertesi sabah erken açmak) planlamaktan kaçınıyor mu?",
  "Is overtime strictly voluntary rather than forced on short notice under threat of penalties?":
    "Fazla mesai, kısa süre önce ve yaptırım tehdidiyle dayatılmak yerine tamamen gönüllülük esasına mı dayanıyor?",
  "Does management respect your personal schedule commitments outside of work?":
    "Yönetim, iş dışındaki kişisel planlarınıza saygı gösteriyor mu?",
  "Are compensation, overtime, and tip payouts calculated transparently and communicated clearly?":
    "Maaş, fazla mesai ve bahşiş ödemeleri şeffaf bir şekilde hesaplanıp açıkça bildiriliyor mu?",
  "Are tips, commissions, or bonuses paid out accurately and transparently?":
    "Bahşişler, primler veya ikramiyeler doğru ve şeffaf bir şekilde ödeniyor mu?",
  "Is the workplace constantly understaffed due to high employee turnover?":
    "İş yeri, yüksek personel devri yüzünden sürekli eleman eksikliği yaşıyor mu?",
  "Is there a clear, realistic path to advance from floor staff to supervisor roles?":
    "Saha çalışanlığından amirliğe yükselmek için net ve gerçekçi bir yol var mı?",
  "Do you feel confident about your long-term job security at this specific business location?":
    "Bu iş yerindeki uzun vadeli iş güvenceniz konusunda kendinizi güvende hissediyor musunuz?",
  "Is physical health and safety genuinely prioritized over production speed or deadlines?":
    "Fiziksel sağlık ve iş güvenliği, üretim hızından veya teslim tarihlerinden gerçekten daha öncelikli mi?",
  "Is the job site free from hazing and harassment?":
    "Çalışma alanı, kötü muamele ve tacizden arınmış mı?",
  "Does management fully respect labor rights, union standards, and safety regulations?":
    "Yönetim, çalışan haklarına, sendikal haklara ve iş güvenliği kurallarına tam olarak uyuyor mu?",
  "Are injured workers treated fairly and supported without fear of job retaliation?":
    "İş kazası geçiren çalışanlara adil davranılıyor ve işten çıkarılma korkusu yaşatılmadan destek veriliyor mu?",
  "Does the crew work as a supportive unit rather than being pitted against each other with metrics?":
    "Ekip, performans ölçümleriyle birbirine karşı yarıştırılmak yerine birbirine destek olan bir bütün olarak mı çalışıyor?",
  "Do site foremen and managers have actual hands-on, practical experience in the work?":
    "Şantiye şefleri ve yöneticiler, bu işi bizzat yapmış, sahada pratik deneyimi olan kişiler mi?",
  "Is physically grueling, dirty, or dangerous work assigned fairly among workers?":
    "Fiziksel olarak yorucu, kirli veya tehlikeli işler çalışanlar arasında adil şekilde dağıtılıyor mu?",
  "Do managers follow the exact same safety rules they enforce on the crew?":
    "Yöneticiler, ekibe uyguladıkları güvenlik kurallarına kendileri de aynen uyuyor mu?",
  "Are unsafe site conditions or broken gear fixed immediately upon being reported?":
    "Güvensiz çalışma koşulları veya bozuk ekipmanlar, bildirildikten hemen sonra düzeltiliyor mu?",
  "Are daily safety briefings clear, realistic, and focused on actual hazard prevention?":
    "Günlük güvenlik bilgilendirmeleri net, gerçekçi ve gerçek tehlikeleri önlemeye yönelik mi?",
  "Are heavy machinery, vehicles, and power tools regularly serviced and safe to operate?":
    "Ağır iş makineleri, araçlar ve elektrikli aletlerin bakımı düzenli yapılıyor ve kullanımları güvenli mi?",
  "Does the employer supply all required personal protective equipment (PPE) free of charge?":
    "İşveren, gerekli kişisel koruyucu donanımları (KKD) ücretsiz olarak sağlıyor mu?",
  "Are clean drinking water, shade/shelter, and functional toilets provided on site?":
    "Sahada temiz içme suyu, gölgelik veya barınak ve çalışır durumda tuvaletler var mı?",
  "Are raw materials delivered on time so you aren't forced to improvise dangerously?":
    "Hammadde sevkiyatları, sizi tehlikeli biçimde idare etmeye zorlamayacak şekilde zamanında yapılıyor mu?",
  "Are emergency first aid kits and safety equipment fully stocked and accessible on site?":
    "İlk yardım çantaları ve acil durum güvenlik ekipmanları sahada eksiksiz ve kolayca ulaşılabilir durumda mı?",
  "Are shift lengths reasonable enough to prevent severe, accident-causing physical exhaustion?":
    "Vardiya süreleri, kazaya yol açabilecek ağır bir yorgunluğa neden olmayacak kadar makul mü?",
  "Can you decline mandatory overtime without threat of termination or disciplinary action?":
    "Zorunlu tutulan fazla mesaiyi, işten çıkarılma veya disiplin cezası korkusu olmadan reddedebiliyor musunuz?",
  "Are mandatory hydration and rest breaks strictly enforced throughout the shift?":
    "Vardiya boyunca su içme ve dinlenme molaları sıkı bir şekilde uygulanıyor mu?",
  "Is travel time to distant job sites or temporary locations properly compensated?":
    "Uzak şantiyelere veya geçici çalışma yerlerine gidip gelirken geçen süre usulüne uygun şekilde ödeniyor mu?",
  "Does your workplace allow your body sufficient recovery time between shifts?":
    "Vardiyalar arasındaki dinlenme süresi, vücudunuzun yeterince toparlanmasına izin veriyor mu?",
  "Is your paycheck always 100% accurate, paid on time, and fully accounting for overtime/hazard pay?":
    "Maaşınız her zaman eksiksiz, zamanında ve fazla mesai ile tehlike primleri dahil doğru ödeniyor mu?",
  "Does your specific role offer consistent, predictable scheduling and hours throughout the year?":
    "Rolünüz, yıl boyunca tutarlı ve öngörülebilir bir çalışma programı ve çalışma saatleri sunuyor mu?",
  "Does the company pay for trade training, safety certifications, or skill upgrades?":
    "Şirket; mesleki eğitimler, güvenlik sertifikaları veya beceri geliştirme için ödeme yapıyor mu?",
  "Does the HR or administrative team handle workplace incident reports and safety paperwork promptly?":
    "İnsan kaynakları veya idari ekip, iş kazası bildirimlerini ve güvenlik evraklarını zamanında işleme alıyor mu?",
  "Is this job's workload sustainable for the next 5 years?":
    "Bu işin iş yükü, önümüzdeki 5 yıl boyunca sürdürülebilir mi?",
};

export default survey;
