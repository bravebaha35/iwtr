// All 81 Turkish provinces with approximate centroid coordinates and their
// districts — used to (a) drive the city/district filter picker and (b)
// approximate "nearby workplaces" sorting from the visitor's browser
// geolocation, since Company only stores a free-text city name, not precise
// coordinates. Source: province/district names and centroid lat/lng adapted
// from https://github.com/enisbt/turkey-cities (public domain city list),
// re-cased to standard Turkish capitalization. If admin-entered Company.city
// values ever drift from these display names, see normalizeCityName() in
// this file, which both the picker and proximity sort match against.
export interface TurkeyProvince {
  plate: string;
  name: string;
  lat: number;
  lng: number;
  districts: string[];
}

export const TURKEY_PROVINCES: TurkeyProvince[] = [
  { plate: "01", name: "Adana", lat: 36.9914, lng: 35.3308, districts: ["Aladağ", "Ceyhan", "Çukurova", "Feke", "İmamoğlu", "Karaisalı", "Karataş", "Kozan", "Pozantı", "Saimbeyli", "Sarıçam", "Seyhan", "Tufanbeyli", "Yumurtalık", "Yüreğir"] },
  { plate: "02", name: "Adıyaman", lat: 37.7636, lng: 38.2773, districts: ["Besni", "Çelikhan", "Gerger", "Gölbaşı", "Kahta", "Merkez", "Samsat", "Sincik", "Tut"] },
  { plate: "03", name: "Afyonkarahisar", lat: 38.7569, lng: 30.5387, districts: ["Başmakçı", "Bayat", "Bolvadin", "Çay", "Çobanlar", "Dazkırı", "Dinar", "Emirdağ", "Evciler", "Hocalar", "İhsaniye", "İscehisar", "Kızılören", "Merkez", "Sandıklı", "Sinanpaşa", "Sultandağı", "Şuhut"] },
  { plate: "04", name: "Ağrı", lat: 39.7191, lng: 43.0506, districts: ["Diyadin", "Doğubayazıt", "Eleşkirt", "Hamur", "Merkez", "Patnos", "Taşlıçay", "Tutak"] },
  { plate: "05", name: "Amasya", lat: 40.6565, lng: 35.8373, districts: ["Göynücek", "Gümüşhacıköy", "Hamamözü", "Merkez", "Merzifon", "Suluova", "Taşova"] },
  { plate: "06", name: "Ankara", lat: 39.9334, lng: 32.8597, districts: ["Akyurt", "Altındağ", "Ayaş", "Bala", "Beypazarı", "Çamlıdere", "Çankaya", "Çubuk", "Elmadağ", "Etimesgut", "Evren", "Gölbaşı", "Güdül", "Haymana", "Kahramankazan", "Kalecik", "Keçiören", "Kızılcahamam", "Mamak", "Nallıhan", "Polatlı", "Pursaklar", "Sincan", "Şereflikoçhisar", "Yenimahalle"] },
  { plate: "07", name: "Antalya", lat: 36.8969, lng: 30.7133, districts: ["Akseki", "Aksu", "Alanya", "Demre", "Döşemealtı", "Elmalı", "Finike", "Gazipaşa", "Gündoğmuş", "İbradı", "Kaş", "Kemer", "Kepez", "Konyaaltı", "Korkuteli", "Kumluca", "Manavgat", "Muratpaşa", "Serik"] },
  { plate: "08", name: "Artvin", lat: 41.1809, lng: 41.8208, districts: ["Ardanuç", "Arhavi", "Borçka", "Hopa", "Kemalpaşa", "Merkez", "Murgul", "Şavşat", "Yusufeli"] },
  { plate: "09", name: "Aydın", lat: 37.838, lng: 27.8456, districts: ["Bozdoğan", "Buharkent", "Çine", "Didim", "Efeler", "Germencik", "İncirliova", "Karacasu", "Karpuzlu", "Koçarlı", "Köşk", "Kuşadası", "Kuyucak", "Nazilli", "Söke", "Sultanhisar", "Yenipazar"] },
  { plate: "10", name: "Balıkesir", lat: 39.6533, lng: 27.8903, districts: ["Altıeylül", "Ayvalık", "Balya", "Bandırma", "Bigadiç", "Burhaniye", "Dursunbey", "Edremit", "Erdek", "Gömeç", "Gönen", "Havran", "İvrindi", "Karesi", "Kepsut", "Manyas", "Marmara", "Savaştepe", "Sındırgı", "Susurluk"] },
  { plate: "11", name: "Bilecik", lat: 40.1426, lng: 29.9793, districts: ["Bozüyük", "Gölpazarı", "İnhisar", "Merkez", "Osmaneli", "Pazaryeri", "Söğüt", "Yenipazar"] },
  { plate: "12", name: "Bingöl", lat: 38.8855, lng: 40.4966, districts: ["Adaklı", "Genç", "Karlıova", "Kiğı", "Merkez", "Solhan", "Yayladere", "Yedisu"] },
  { plate: "13", name: "Bitlis", lat: 38.4006, lng: 42.1095, districts: ["Adilcevaz", "Ahlat", "Güroymak", "Hizan", "Merkez", "Mutki", "Tatvan"] },
  { plate: "14", name: "Bolu", lat: 40.7325, lng: 31.6082, districts: ["Dörtdivan", "Gerede", "Göynük", "Kıbrıscık", "Mengen", "Merkez", "Mudurnu", "Seben", "Yeniçağa"] },
  { plate: "15", name: "Burdur", lat: 37.7183, lng: 30.2823, districts: ["Ağlasun", "Altınyayla", "Bucak", "Çavdır", "Çeltikçi", "Gölhisar", "Karamanlı", "Kemer", "Merkez", "Tefenni", "Yeşilova"] },
  { plate: "16", name: "Bursa", lat: 40.1885, lng: 29.061, districts: ["Büyükorhan", "Gemlik", "Gürsu", "Harmancık", "İnegöl", "İznik", "Karacabey", "Keles", "Kestel", "Mudanya", "Mustafakemalpaşa", "Nilüfer", "Orhaneli", "Orhangazi", "Osmangazi", "Yenişehir", "Yıldırım"] },
  { plate: "17", name: "Çanakkale", lat: 40.1467, lng: 26.4086, districts: ["Ayvacık", "Bayramiç", "Biga", "Bozcaada", "Çan", "Eceabat", "Ezine", "Gelibolu", "Gökçeada", "Lapseki", "Merkez", "Yenice"] },
  { plate: "18", name: "Çankırı", lat: 40.6002, lng: 33.6162, districts: ["Atkaracalar", "Bayramören", "Çerkeş", "Eldivan", "Ilgaz", "Kızılırmak", "Korgun", "Kurşunlu", "Merkez", "Orta", "Şabanözü", "Yapraklı"] },
  { plate: "19", name: "Çorum", lat: 40.5499, lng: 34.9537, districts: ["Alaca", "Bayat", "Boğazkale", "Dodurga", "İskilip", "Kargı", "Laçin", "Mecitözü", "Merkez", "Oğuzlar", "Ortaköy", "Osmancık", "Sungurlu", "Uğurludağ"] },
  { plate: "20", name: "Denizli", lat: 37.783, lng: 29.0963, districts: ["Acıpayam", "Babadağ", "Baklan", "Bekilli", "Beyağaç", "Bozkurt", "Buldan", "Çal", "Çameli", "Çardak", "Çivril", "Güney", "Honaz", "Kale", "Merkezefendi", "Pamukkale", "Sarayköy", "Serinhisar", "Tavas"] },
  { plate: "21", name: "Diyarbakır", lat: 37.925, lng: 40.211, districts: ["Bağlar", "Bismil", "Çermik", "Çınar", "Çüngüş", "Dicle", "Eğil", "Ergani", "Hani", "Hazro", "Kayapınar", "Kocaköy", "Kulp", "Lice", "Silvan", "Sur", "Yenişehir"] },
  { plate: "22", name: "Edirne", lat: 41.6771, lng: 26.5557, districts: ["Enez", "Havsa", "İpsala", "Keşan", "Lalapaşa", "Meriç", "Merkez", "Süloğlu", "Uzunköprü"] },
  { plate: "23", name: "Elazığ", lat: 38.6748, lng: 39.2225, districts: ["Ağın", "Alacakaya", "Arıcak", "Baskil", "Karakoçan", "Keban", "Kovancılar", "Maden", "Merkez", "Palu", "Sivrice"] },
  { plate: "24", name: "Erzincan", lat: 39.7468, lng: 39.4911, districts: ["Çayırlı", "İliç", "Kemah", "Kemaliye", "Merkez", "Otlukbeli", "Tercan", "Üzümlü"] },
  { plate: "25", name: "Erzurum", lat: 39.9055, lng: 41.2658, districts: ["Aşkale", "Aziziye", "Çat", "Hınıs", "Horasan", "İspir", "Karaçoban", "Karayazı", "Köprüköy", "Narman", "Oltu", "Olur", "Palandöken", "Pasinler", "Pazaryolu", "Şenkaya", "Tekman", "Tortum", "Uzundere", "Yakutiye"] },
  { plate: "26", name: "Eskişehir", lat: 39.7667, lng: 30.5256, districts: ["Alpu", "Beylikova", "Çifteler", "Günyüzü", "Han", "İnönü", "Mahmudiye", "Mihalgazi", "Mihalıççık", "Odunpazarı", "Sarıcakaya", "Seyitgazi", "Sivrihisar", "Tepebaşı"] },
  { plate: "27", name: "Gaziantep", lat: 37.066, lng: 37.3781, districts: ["Araban", "İslahiye", "Karkamış", "Nizip", "Nurdağı", "Oğuzeli", "Şahinbey", "Şehitkamil", "Yavuzeli"] },
  { plate: "28", name: "Giresun", lat: 40.9175, lng: 38.3927, districts: ["Alucra", "Bulancak", "Çamoluk", "Çanakçı", "Dereli", "Doğankent", "Espiye", "Eynesil", "Görele", "Güce", "Keşap", "Merkez", "Piraziz", "Şebinkarahisar", "Tirebolu", "Yağlıdere"] },
  { plate: "29", name: "Gümüşhane", lat: 40.4608, lng: 39.4803, districts: ["Kelkit", "Köse", "Kürtün", "Merkez", "Şiran", "Torul"] },
  { plate: "30", name: "Hakkari", lat: 37.5774, lng: 43.7368, districts: ["Çukurca", "Derecik", "Merkez", "Şemdinli", "Yüksekova"] },
  { plate: "31", name: "Hatay", lat: 36.2023, lng: 36.1613, districts: ["Altınözü", "Antakya", "Arsuz", "Belen", "Defne", "Dörtyol", "Erzin", "Hassa", "İskenderun", "Kırıkhan", "Kumlu", "Payas", "Reyhanlı", "Samandağ", "Yayladağı"] },
  { plate: "32", name: "Isparta", lat: 37.7626, lng: 30.5537, districts: ["Aksu", "Atabey", "Eğirdir", "Gelendost", "Gönen", "Keçiborlu", "Merkez", "Senirkent", "Sütçüler", "Şarkikaraağaç", "Uluborlu", "Yalvaç", "Yenişarbademli"] },
  { plate: "33", name: "Mersin", lat: 36.8121, lng: 34.6415, districts: ["Akdeniz", "Anamur", "Aydıncık", "Bozyazı", "Çamlıyayla", "Erdemli", "Gülnar", "Mezitli", "Mut", "Silifke", "Tarsus", "Toroslar", "Yenişehir"] },
  { plate: "34", name: "İstanbul", lat: 41.0082, lng: 28.9784, districts: ["Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane", "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer", "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu"] },
  { plate: "35", name: "İzmir", lat: 38.4237, lng: 27.1428, districts: ["Aliağa", "Balçova", "Bayındır", "Bayraklı", "Bergama", "Beydağ", "Bornova", "Buca", "Çeşme", "Çiğli", "Dikili", "Foça", "Gaziemir", "Güzelbahçe", "Karabağlar", "Karaburun", "Karşıyaka", "Kemalpaşa", "Kınık", "Kiraz", "Konak", "Menderes", "Menemen", "Narlıdere", "Ödemiş", "Seferihisar", "Selçuk", "Tire", "Torbalı", "Urla"] },
  { plate: "36", name: "Kars", lat: 40.6013, lng: 43.0975, districts: ["Akyaka", "Arpaçay", "Digor", "Kağızman", "Merkez", "Sarıkamış", "Selim", "Susuz"] },
  { plate: "37", name: "Kastamonu", lat: 41.3766, lng: 33.7765, districts: ["Abana", "Ağlı", "Araç", "Azdavay", "Bozkurt", "Cide", "Çatalzeytin", "Daday", "Devrekani", "Doğanyurt", "Hanönü", "İhsangazi", "İnebolu", "Küre", "Merkez", "Pınarbaşı", "Seydiler", "Şenpazar", "Taşköprü", "Tosya"] },
  { plate: "38", name: "Kayseri", lat: 38.7205, lng: 35.4826, districts: ["Akkışla", "Bünyan", "Develi", "Felahiye", "Hacılar", "İncesu", "Kocasinan", "Melikgazi", "Özvatan", "Pınarbaşı", "Sarıoğlan", "Sarız", "Talas", "Tomarza", "Yahyalı", "Yeşilhisar"] },
  { plate: "39", name: "Kırklareli", lat: 41.7355, lng: 27.2244, districts: ["Babaeski", "Demirköy", "Kofçaz", "Lüleburgaz", "Merkez", "Pehlivanköy", "Pınarhisar", "Vize"] },
  { plate: "40", name: "Kırşehir", lat: 39.1461, lng: 34.1595, districts: ["Akçakent", "Akpınar", "Boztepe", "Çiçekdağı", "Kaman", "Merkez", "Mucur"] },
  { plate: "41", name: "Kocaeli", lat: 40.7654, lng: 29.9408, districts: ["Başiskele", "Çayırova", "Darıca", "Derince", "Dilovası", "Gebze", "Gölcük", "İzmit", "Kandıra", "Karamürsel", "Kartepe", "Körfez"] },
  { plate: "42", name: "Konya", lat: 37.8746, lng: 32.4932, districts: ["Ahırlı", "Akören", "Akşehir", "Altınekin", "Beyşehir", "Bozkır", "Cihanbeyli", "Çeltik", "Çumra", "Derbent", "Derebucak", "Doğanhisar", "Emirgazi", "Ereğli", "Güneysınır", "Hadim", "Halkapınar", "Hüyük", "Ilgın", "Kadınhanı", "Karapınar", "Karatay", "Kulu", "Meram", "Sarayönü", "Selçuklu", "Seydişehir", "Taşkent", "Tuzlukçu", "Yalıhüyük", "Yunak"] },
  { plate: "43", name: "Kütahya", lat: 39.42, lng: 29.9857, districts: ["Altıntaş", "Aslanapa", "Çavdarhisar", "Domaniç", "Dumlupınar", "Emet", "Gediz", "Hisarcık", "Merkez", "Pazarlar", "Simav", "Şaphane", "Tavşanlı"] },
  { plate: "44", name: "Malatya", lat: 38.3554, lng: 38.3335, districts: ["Akçadağ", "Arapgir", "Arguvan", "Battalgazi", "Darende", "Doğanşehir", "Doğanyol", "Hekimhan", "Kale", "Kuluncak", "Pütürge", "Yazıhan", "Yeşilyurt"] },
  { plate: "45", name: "Manisa", lat: 38.614, lng: 27.4296, districts: ["Ahmetli", "Akhisar", "Alaşehir", "Demirci", "Gölmarmara", "Gördes", "Kırkağaç", "Köprübaşı", "Kula", "Salihli", "Sarıgöl", "Saruhanlı", "Selendi", "Soma", "Şehzadeler", "Turgutlu", "Yunusemre"] },
  { plate: "46", name: "Kahramanmaraş", lat: 37.5753, lng: 36.9228, districts: ["Afşin", "Andırın", "Çağlayancerit", "Dulkadiroğlu", "Ekinözü", "Elbistan", "Göksun", "Nurhak", "Onikişubat", "Pazarcık", "Türkoğlu"] },
  { plate: "47", name: "Mardin", lat: 37.3129, lng: 40.734, districts: ["Artuklu", "Dargeçit", "Derik", "Kızıltepe", "Mazıdağı", "Midyat", "Nusaybin", "Ömerli", "Savur", "Yeşilli"] },
  { plate: "48", name: "Muğla", lat: 37.2154, lng: 28.3634, districts: ["Bodrum", "Dalaman", "Datça", "Fethiye", "Kavaklıdere", "Köyceğiz", "Marmaris", "Menteşe", "Milas", "Ortaca", "Seydikemer", "Ula", "Yatağan"] },
  { plate: "49", name: "Muş", lat: 38.7346, lng: 41.491, districts: ["Bulanık", "Hasköy", "Korkut", "Malazgirt", "Merkez", "Varto"] },
  { plate: "50", name: "Nevşehir", lat: 38.6247, lng: 34.7142, districts: ["Acıgöl", "Avanos", "Derinkuyu", "Gülşehir", "Hacıbektaş", "Kozaklı", "Merkez", "Ürgüp"] },
  { plate: "51", name: "Niğde", lat: 37.9698, lng: 34.6766, districts: ["Altunhisar", "Bor", "Çamardı", "Çiftlik", "Merkez", "Ulukışla"] },
  { plate: "52", name: "Ordu", lat: 40.9862, lng: 37.8797, districts: ["Akkuş", "Altınordu", "Aybastı", "Çamaş", "Çatalpınar", "Çaybaşı", "Fatsa", "Gölköy", "Gülyalı", "Gürgentepe", "İkizce", "Kabadüz", "Kabataş", "Korgan", "Kumru", "Mesudiye", "Perşembe", "Ulubey", "Ünye"] },
  { plate: "53", name: "Rize", lat: 41.0255, lng: 40.5177, districts: ["Ardeşen", "Çamlıhemşin", "Çayeli", "Derepazarı", "Fındıklı", "Güneysu", "Hemşin", "İkizdere", "İyidere", "Kalkandere", "Merkez", "Pazar"] },
  { plate: "54", name: "Sakarya", lat: 40.7889, lng: 30.406, districts: ["Adapazarı", "Akyazı", "Arifiye", "Erenler", "Ferizli", "Geyve", "Hendek", "Karapürçek", "Karasu", "Kaynarca", "Kocaali", "Pamukova", "Sapanca", "Serdivan", "Söğütlü", "Taraklı"] },
  { plate: "55", name: "Samsun", lat: 41.2797, lng: 36.3361, districts: ["19 Mayıs", "Alaçam", "Asarcık", "Atakum", "Ayvacık", "Bafra", "Canik", "Çarşamba", "Havza", "İlkadım", "Kavak", "Ladik", "Salıpazarı", "Tekkeköy", "Terme", "Vezirköprü", "Yakakent"] },
  { plate: "56", name: "Siirt", lat: 37.9274, lng: 41.942, districts: ["Baykan", "Eruh", "Kurtalan", "Merkez", "Pervari", "Şirvan", "Tillo"] },
  { plate: "57", name: "Sinop", lat: 42.028, lng: 35.1517, districts: ["Ayancık", "Boyabat", "Dikmen", "Durağan", "Erfelek", "Gerze", "Merkez", "Saraydüzü", "Türkeli"] },
  { plate: "58", name: "Sivas", lat: 39.7505, lng: 37.015, districts: ["Akıncılar", "Altınyayla", "Divriği", "Doğanşar", "Gemerek", "Gülova", "Gürün", "Hafik", "İmranlı", "Kangal", "Koyulhisar", "Merkez", "Suşehri", "Şarkışla", "Ulaş", "Yıldızeli", "Zara"] },
  { plate: "59", name: "Tekirdağ", lat: 40.9781, lng: 27.5117, districts: ["Çerkezköy", "Çorlu", "Ergene", "Hayrabolu", "Kapaklı", "Malkara", "Marmaraereğlisi", "Muratlı", "Saray", "Süleymanpaşa", "Şarköy"] },
  { plate: "60", name: "Tokat", lat: 40.3235, lng: 36.5522, districts: ["Almus", "Artova", "Başçiftlik", "Erbaa", "Merkez", "Niksar", "Pazar", "Reşadiye", "Sulusaray", "Turhal", "Yeşilyurt", "Zile"] },
  { plate: "61", name: "Trabzon", lat: 41.0027, lng: 39.7168, districts: ["Akçaabat", "Araklı", "Arsin", "Beşikdüzü", "Çarşıbaşı", "Çaykara", "Dernekpazarı", "Düzköy", "Hayrat", "Köprübaşı", "Maçka", "Of", "Ortahisar", "Sürmene", "Şalpazarı", "Tonya", "Vakfıkebir", "Yomra"] },
  { plate: "62", name: "Tunceli", lat: 39.1062, lng: 39.5483, districts: ["Çemişgezek", "Hozat", "Mazgirt", "Merkez", "Nazımiye", "Ovacık", "Pertek", "Pülümür"] },
  { plate: "63", name: "Şanlıurfa", lat: 37.1674, lng: 38.7955, districts: ["Akçakale", "Birecik", "Bozova", "Ceylanpınar", "Eyyübiye", "Halfeti", "Haliliye", "Harran", "Hilvan", "Karaköprü", "Siverek", "Suruç", "Viranşehir"] },
  { plate: "64", name: "Uşak", lat: 38.6742, lng: 29.4059, districts: ["Banaz", "Eşme", "Karahallı", "Merkez", "Sivaslı", "Ulubey"] },
  { plate: "65", name: "Van", lat: 38.5012, lng: 43.373, districts: ["Bahçesaray", "Başkale", "Çaldıran", "Çatak", "Edremit", "Erciş", "Gevaş", "Gürpınar", "İpekyolu", "Muradiye", "Özalp", "Saray", "Tuşba"] },
  { plate: "66", name: "Yozgat", lat: 39.821, lng: 34.8086, districts: ["Akdağmadeni", "Aydıncık", "Boğazlıyan", "Çandır", "Çayıralan", "Çekerek", "Kadışehri", "Merkez", "Saraykent", "Sarıkaya", "Sorgun", "Şefaatli", "Yenifakıllı", "Yerköy"] },
  { plate: "67", name: "Zonguldak", lat: 41.4535, lng: 31.7894, districts: ["Alaplı", "Çaycuma", "Devrek", "Ereğli", "Gökçebey", "Kilimli", "Kozlu", "Merkez"] },
  { plate: "68", name: "Aksaray", lat: 38.3686, lng: 34.0297, districts: ["Ağaçören", "Eskil", "Gülağaç", "Güzelyurt", "Merkez", "Ortaköy", "Sarıyahşi", "Sultanhanı"] },
  { plate: "69", name: "Bayburt", lat: 40.2603, lng: 40.228, districts: ["Aydıntepe", "Demirözü", "Merkez"] },
  { plate: "70", name: "Karaman", lat: 37.181, lng: 33.2222, districts: ["Ayrancı", "Başyayla", "Ermenek", "Kazımkarabekir", "Merkez", "Sarıevliler"] },
  { plate: "71", name: "Kırıkkale", lat: 39.8398, lng: 33.5089, districts: ["Bahşili", "Balışeyh", "Çelebi", "Delice", "Karakeçili", "Keskin", "Merkez", "Sulakyurt", "Yahşihan"] },
  { plate: "72", name: "Batman", lat: 37.8895, lng: 41.1293, districts: ["Beşiri", "Gerçüş", "Hasankeyf", "Kozluk", "Merkez", "Sason"] },
  { plate: "73", name: "Şırnak", lat: 37.519, lng: 42.4537, districts: ["Beytüşşebap", "Cizre", "Güçlükonak", "İdil", "Merkez", "Silopi", "Uludere"] },
  { plate: "74", name: "Bartın", lat: 41.6376, lng: 32.3338, districts: ["Amasra", "Kurucaşile", "Merkez", "Ulus"] },
  { plate: "75", name: "Ardahan", lat: 41.113, lng: 42.7023, districts: ["Çıldır", "Damal", "Göle", "Hanak", "Merkez", "Posof"] },
  { plate: "76", name: "Iğdır", lat: 39.9201, lng: 44.0436, districts: ["Aralık", "Karakoyunlu", "Merkez", "Tuzluca"] },
  { plate: "77", name: "Yalova", lat: 40.6549, lng: 29.2842, districts: ["Altınova", "Armutlu", "Çınarcık", "Çiftlikköy", "Merkez", "Termal"] },
  { plate: "78", name: "Karabük", lat: 41.1956, lng: 32.6227, districts: ["Eflani", "Eskipazar", "Merkez", "Ovacık", "Safranbolu", "Yenice"] },
  { plate: "79", name: "Kilis", lat: 36.7165, lng: 37.1147, districts: ["Elbeyli", "Merkez", "Musabeyli", "Polateli"] },
  { plate: "80", name: "Osmaniye", lat: 37.0746, lng: 36.2464, districts: ["Bahçe", "Düziçi", "Hasanbeyli", "Kadirli", "Merkez", "Sumbas", "Toprakkale"] },
  { plate: "81", name: "Düzce", lat: 40.8387, lng: 31.1626, districts: ["Akçakoca", "Cumayeri", "Çilimli", "Gölyaka", "Gümüşova", "Kaynaşlı", "Merkez", "Yığılca"] },
];

// Loose match so admin-typed Company.city values (any case/diacritics
// inconsistency) still resolve to a canonical province for distance
// calculations and filter matching.
export function normalizeCityName(value: string): string {
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

const PROVINCE_BY_NORMALIZED_NAME = new Map(
  TURKEY_PROVINCES.map((p) => [normalizeCityName(p.name), p]),
);

export function findProvinceByCityName(cityName: string | null | undefined): TurkeyProvince | null {
  if (!cityName) return null;
  return PROVINCE_BY_NORMALIZED_NAME.get(normalizeCityName(cityName)) ?? null;
}

// Haversine distance in kilometers.
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
