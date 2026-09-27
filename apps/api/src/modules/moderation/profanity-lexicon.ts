// English + Turkish swear words, slurs, sexual terms and direct insults for
// ModerationService (reviews, IWT Social captions/comments, private messages).
//
// Built 2026-09-27 from three public lists, then curated by hand:
//   - LDNOOBW "List of Dirty, Naughty, Obscene and Otherwise Bad Words" (en, tr)
//   - ooguz/turkce-kufur-karaliste (Turkish swear-word blacklist)
// Deliberately LEFT OUT because they are ordinary words too, and would block
// normal reviews: "allah", "am" (English "I am"), "ana"/"anan", "mal" (goods),
// "meme", "kaşar" (cheese), "hayvan", "eşek"/"öküz" ("worked like a donkey"),
// "sik"/"siki"/"sikis" (ASCII "sık"/"sıkı"/"sıkış": often/tight/squeeze),
// "göt" in ASCII ("got"), "oc", "cum" (cum laude), "tit" (a bird), "escort",
// "butt", "loser", "sexual"/"rape" (people must be able to report sexual
// harassment), "abaza"/"çingene" (ethnic groups), and the lists' spelling
// junk ("ag", "emi", "cim", "sie", ...).
//
// Every entry is written in "folded" form: lower case, Turkish letters
// flattened to ASCII (ç→c ğ→g ı→i ö→o ş→s ü→u) - see profanity-matcher.ts.
// UNFOLDED_EXACT is the exception: words that are only rude WITH their
// Turkish letters (plain ASCII spelling is an everyday word).

/** Whole word only (never as the start of a longer word). */
export const EXACT_WORDS: readonly string[] = [
  // English
  "ass", "arse", "asses", "dick", "dicks", "cock", "cocks", "prick", "pricks", "twat", "cunt", "cunts", "piss",
  "tosser", "bollocks", "boob", "boobs", "tits", "titty", "titties", "pussy", "pussies", "anal", "anus", "jizz",
  "dumb", "retard", "retards", "retarded", "milf", "wtf", "stfu", "gtfo", "fck", "fk", "fuk", "phuck", "sht",
  "fag", "fags", "paki", "pakis", "spic", "spics", "kike", "kikes", "gook", "gooks", "chink", "chinks",
  "dyke", "dykes", "tranny", "trannies", "nigga", "niggas", "negro", "negros",
  // Turkish
  "amk", "amq", "aq", "amcik", "amck", "amcuk", "amik", "amna", "amina", "aminako", "aminakoyim", "amini",
  "sikerim", "sikeyim", "sikiyim", "sikim", "sikimi", "sikime", "sikik", "sikko", "sikmek",
  "skerim", "skeyim", "sktir", "sktr", "hsktr", "s1kerim",
  "bok", "boka", "boku", "bokum", "boktan", "bokunu",
  "gotu", "gotun", "gotune", "gotunu", "gotunden", "gotler", "gotlek", "gotos", "gotelek",
  "ipne", "pust", "pezo", "geber", "gebersin", "gebertirim", "sakso", "seks", "seksi", "picler",
];

/** Rude only with Turkish letters (see file comment). Compared lower-cased, NOT folded. */
export const UNFOLDED_EXACT_WORDS: readonly string[] = [
  "göt", "götü", "götün", "göte", "çük", "oç", "piç", "piçler", "sikiş", "sikişme", "sikişmek", "siktiğim",
  "siktiğimin",
  // NOT "sik", "siki", "sikti", "siktim", "sikiyor": typed without Turkish
  // letters they are exactly "sık", "sıkı", "sıktı", "sıktım", "sıkıyor"
  // (often, tight, squeezed, got bored) - far too common to block.
];

/**
 * Word starts: a word beginning with one of these is rude (catches Turkish
 * suffixes - "orospuya", "salaklar", "şerefsizler" - and English endings -
 * "fucking", "bitches", "idiots"). Each was checked against normal words
 * that start the same way.
 */
export const PREFIX_WORDS: readonly string[] = [
  // English swearing
  "fuck", "fucc", "fuk", "motherf", "shit", "sh1t", "bullshit", "bitch", "b1tch", "biatch", "bastard", "asshole",
  "arsehole", "asshat", "jackass", "dumbass", "smartass", "dipshit", "douche", "dickhead", "cocksucker", "wank",
  "whore", "slut", "skank", "scumbag", "shithead", "goddamn", "damnit",
  // English insults
  "stupid", "idiot", "moron", "imbecil", "cretin", "halfwit", "dimwit", "numbskull", "nitwit",
  // English slurs
  "nigger", "faggot", "negroid", "wetback", "raghead", "towelhead", "beaner", "jigaboo", "darkie", "honkey",
  "slanteye", "shemale",
  // English sexual
  "porn", "p0rn", "blowjob", "handjob", "rimjob", "cumshot", "creampie", "gangbang", "bukkake", "dildo",
  "masturbat", "orgasm", "horny", "hentai", "erotic", "fetish", "bdsm", "bondage", "threesome", "nude",
  // Turkish swearing
  "orospu", "orosbu", "oruspu", "orrospu", "siktir", "sikeri", "sikecem", "hassiktir", "hasiktir", "amina", "aminak", "amcik", "amcig", "yarrak", "yarrag", "yarak",
  "dalyarak", "dalyarrak", "tasak", "tassak", "tassag", "tasag", "kaltak", "kaltag", "pezevenk", "pezeveng",
  "kahpe", "kevase", "fahise", "surtuk", "yavsak", "gavat", "kavat", "godos", "sillik", "gotveren", "ibne",
  "nonos", "saksocu", "otuzbirci", "domal",
  // Turkish insults
  "serefsiz", "haysiyetsiz", "namussuz", "gerizekal", "gerzek", "salak", "aptal", "ahmak", "dangalak",
  "embesil", "angut", "dallama", "lavuk", "hodukk", "hoduk", "beyinsiz", "cibiliyetsiz", "cibilliyetsiz",
  // Turkish sexual
  "orgazm", "masturbas",
];

/** Multi-word phrases, matched as whole words in order. */
export const PHRASES: readonly string[] = [
  "son of a bitch", "piece of shit", "go to hell", "shut the fuck up", "fuck off", "fuck you", "suck my",
  "blow job", "hand job", "white power",
  "amina koy", "amina koyim", "amina koyayim", "amina koyarim", "anani sikeyim", "anani sikerim",
  "orospu cocugu", "orospunun evladi", "has siktir", "siktir git", "siktir lan", "siktir ol git",
  "otuz birci", "got veren", "got deligi", "veled i zina", "ananin ami",
];

/**
 * Also caught INSIDE a longer run of letters ("youfuckingidiot",
 * "s i k t i r g i t"). Only long, unmistakable roots that never occur
 * inside a normal English or Turkish word - never "ass" (class, assistant)
 * or "cunt" (Scunthorpe).
 */
export const EMBEDDED_WORDS: readonly string[] = [
  "fuck", "motherfucker", "bullshit", "asshole", "nigger", "faggot", "orospu", "siktir", "yarrak", "amcik",
  "pezevenk", "gerizekal", "serefsiz", "yavsak", "kahpe", "stupid", "idiot",
];
