import { findProfanity } from "../profanity-matcher";

const hit = (text: string) => {
  const m = findProfanity(text);
  return m.plain || m.evasive;
};

describe("findProfanity - catches", () => {
  it.each([
    "you are so stupid",
    "what an idiot",
    "the manager is a moron",
    "fuck this place",
    "this is bullshit",
    "shut the fuck up",
    "son of a bitch",
    "total asshole",
    "orospu çocuğu",
    "siktir git",
    "Şerefsiz herifler",
    "serefsiz",
    "SALAK",
    "salaklar",
    "aptalın teki",
    "gerizekalı müdür",
    "amk",
    "ananı sikeyim",
    "amına koyayım",
    "yavşak",
    "pezevenk",
    "ibne",
    "kahpe",
    "göt herif",
    "piç",
    "porno",
    "nigger",
    "faggot",
    "What's up negro ?",
  ])("plain: %s", (text) => {
    expect(findProfanity(text).plain).toBe(true);
  });

  it.each([
    "s t u p i d",
    "S T U P I D",
    "s.t.u.p.i.d",
    "s-i-k-t-i-r",
    "o r o s p u",
    "a p t a l",
    "you are s t u p i d guy",
    "y o u a r e s t u p i d",
    "f u c k",
    "f * c k",
    "f*ck off",
    "sh1t",
    "0rospu",
    "fuuuuuck",
    "salaaaak",
    "stu pid",
    "sik tir",
    "oro spu",
    "ş e r e f s i z",
  ])("evasive: %s", (text) => {
    expect(hit(text)).toBe(true);
  });
});

describe("findProfanity - leaves normal text alone", () => {
  it.each([
    // English
    "I am happy with my class and the assistant manager was helpful.",
    "The assessment process took a while but I got the job.",
    "We had gotten used to the long shifts.",
    "Scunthorpe office, great cocktail parties, summa cum laude colleagues.",
    "They helped me report sexual harassment quickly.",
    "An analysis of the analytics team: good pay, fair hours.",
    "I passed the exam, and the boss said it is fine.",
    "Great escort service for night shifts to the bus stop.",
    "Glass ceiling, hard assignments, but great mentors.",
    "Title: Assistant. I would recommend it.",
    // Turkish
    "Allah razı olsun, çok iyi bir şirket.",
    "Maaşlar sık sık gecikiyordu, çok sıkıntı yaşadık.",
    "Maasalar sik sik gecikiyordu, cok sikinti yasadik.",
    "Mesai çok sıkıcı ve canımı sıkıyor.",
    "Mesai cok sikici ve canimi sikiyor, patron sikti bizi mesaiyle.",
    "Trafik sıkıştı, servis geç kaldı; sikisik bir ortam.",
    "Seksen kişilik bir ekip, sekiz saat çalışıyoruz.",
    "Eşek gibi çalıştırdılar ama maaş iyiydi.",
    "O çocuğu işe aldılar, çok iyi bir çalışan.",
    "Mal ve hizmet alımı, kaşar peyniri üretimi yapan bir fabrika.",
    "Ana binada toplantı yaptık, annem de orada çalışıyordu.",
    "Belgeleri götürdüm, müdür götürüp imzalattı.",
    "Sokakta park yeri yok, anahtarı kapıya sokarım.",
    "Yaramı sardılar, iş kazası sonrası ilgilendiler.",
    "Apt al sat işi yapan emlak ofisi.",
    "Amin, sonunda maaş zammı geldi.",
    "Tasarım ekibi çok iyi, taşınma sürecinde yardım ettiler.",
    "Domates tarlasında çalıştım, sabah altıda başlardık.",
    "A.B.D. merkezli bir şirket, T.C. vatandaşı olmak gerekiyor.",
    "Yıllık izin 14 gün, 2019-2023 arası çalıştım.",
    "Pustu kurdular dediler ama asılsızdı; pusu yok.",
  ])("%s", (text) => {
    expect(hit(text)).toBe(false);
  });
});
