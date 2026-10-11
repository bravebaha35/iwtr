import { findProfanity } from "../profanity-matcher";

const hit = (text: string) => {
  const m = findProfanity(text);
  return m.plain || m.evasive;
};

// "nıggga" (dotless ı, stretched g) is how it was typed in a real company
// reply on the dev site: it has to be caught as a dodge.
it("catches a stretched slur typed with a Turkish dotless ı", () => {
  expect(hit("nıggga")).toBe(true);
});

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
    "sup nigga",
    "niggaz everywhere",
    "those negroes",
    "a bunch of coons",
    "dirty wog",
    "the chinaman at the desk",
    "ching chong",
    "he called me a kike",
    "filthy yid",
    "go home paki",
    "lazy spic",
    "towelhead boss",
    "camel jockey",
    "white trash team",
    "such a spaz",
    "mongoloid manager",
    "the new guy is a poofter",
    "heil hitler",
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
    // Look like the 2026-10-12 slur additions but are ordinary words or names.
    "Nigar Hanım çok yardımcı oldu.",
    "A niggling issue with the payroll system.",
    "We had a negroni at the team dinner.",
    "The raccoon got into the warehouse again.",
    "Japonya ofisiyle çalıştık, Japon müşteriler memnundu.",
    "Kafir diye bir söz duymadım, ortam saygılıydı.",
    "Abo, bu kadar mesai olur mu!",
    "The spade work was done by interns; nothing spooky about it.",
  ])("%s", (text) => {
    expect(hit(text)).toBe(false);
  });
});
