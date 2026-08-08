# Turkey-wide company directory seeding playbook

Worked out and validated end-to-end on Istanbul (province code `TR-34`). This
is the repeatable procedure for the remaining 80 provinces — each of the
three scripts referenced here currently hardcodes Istanbul; turning this into
a true per-province loop (parameterizing province ISO code, name, and
district list) is the natural next step once this is run a few more times
and the rules below are confirmed stable.

## Why this exists

The company directory started with 10 hand-written demo companies. This
playbook is how it grew into a real, city-by-city directory of private
employers pulled from OpenStreetMap, with government/political entities
filtered out and names cleaned up — without scraping any personal contact
data (phone/email), which was a deliberate scope decision (see "What this
deliberately does NOT do" below).

## Step 1 — Seed from OpenStreetMap

Script: `scripts/seed-istanbul-companies.ts` (rename per-province when
generalized, e.g. `seed-<province-slug>-companies.ts`)

- **Source**: Overpass API (`https://overpass-api.de/api/interpreter`), one
  query per province scoped by `area["ISO3166-2"="TR-XX"]`. Request body must
  be `application/x-www-form-urlencoded` with a `data=` param — a raw
  `text/plain` POST body gets a 406 from Overpass's Apache front end. Also
  set an explicit `User-Agent` header (Node's default fetch UA triggers the
  same 406).
- **Tags queried**: `office=*` and `craft=*`, both requiring a `name` tag
  present. Deliberately excludes `shop=*` (too high-volume/low-signal for an
  employer-review directory — mostly tiny retail) and pure `landuse=industrial`
  polygons (land parcels, not individual businesses).
- **Fields collected**: name, category (derived from the specific
  `office=`/`craft=` tag value via a lookup table, falling back to
  title-cased raw tag value), workplaceType (`office=*` → `OFFICE`,
  `craft=*` → `MANUAL_LABOUR`), city (the province's canonical display name,
  e.g. `"İstanbul"`), district (matched against the province's own district
  list — see matching below). **Deliberately does NOT collect**: address,
  phone, email, website, or lat/lng — see "What this deliberately does NOT
  do".
- **District matching**: normalize both the OSM candidate (`addr:district`,
  `addr:suburb`, `is_in:district`, `addr:city` — checked in that order) and
  the province's known district list via the same ASCII-fold function
  (lowercase + tr-TR locale + strip ı/ğ/ü/ş/ö/ç to i/g/u/s/o/c), then exact-match.
  No fuzzy matching — if nothing matches, the record is dropped rather than
  guessed. **Expect roughly a third of raw OSM results to have no usable
  district tag** (just "Istanbul" with no finer detail) — this ratio held
  for Istanbul and will likely hold elsewhere.
- **Reused district data**: copy the target province's entry (name +
  district array) from `apps/web/src/lib/turkeyGeo.ts`'s `TURKEY_PROVINCES` —
  that's the single source of truth the browse-page filters already use, so
  seeded `city`/`district` values must match it exactly or the filter UI
  won't resolve them.
- **Closed/disused filter**: reject OSM lifecycle tags `disused=*`,
  `abandoned=*`, `shop=vacant`, `office=no`, `opening_hours` containing
  "closed" (any language-insensitive substring check).
- **Personal-name filter**: reject names matching a plain two-capitalized-word
  pattern (looks like "Firstname Lastname") UNLESS the name also contains a
  corporate marker (a.ş, ltd, sti, holding, sanayi, ticaret, grup, group,
  co., corp.). Uses the **Unicode-letter-boundary regex**, not plain `\b` —
  JS's `\b` doesn't treat Ç/Ğ/İ/Ö/Ş/Ü as word characters, so a plain-`\b`
  pattern silently fails to match any Turkish name starting with one of
  those six letters (this exact bug was caught and fixed in
  `moderation.service.ts`'s `NAME_LIKE_PATTERN` during an earlier audit —
  reuse `(?<![\p{L}\p{N}])...(?![\p{L}\p{N}])` with the `u` flag instead).
- **Dedup**: case/diacritic-normalized name, first occurrence wins.
- **Insertion**: goes through the real `CompaniesService.createByAdmin`
  (instantiated directly against a `PrismaService`, not via HTTP — no admin
  login token needed for a script, just the DB), not a raw upsert. This
  reuses the exact same name-uniqueness check, slug generation +
  collision-suffix loop, and employment-history backfill the admin UI itself
  uses, rather than duplicating that logic. `ConflictException` (duplicate
  name) is caught and counted as "skipped," not a hard failure.
- **Overpass fair-use**: a single province at a time via the public API
  worked fine for Istanbul (~5,500 elements, well under any timeout). A
  nationwide single query would not — Overpass's public instance actively
  discourages exactly that. Loop provinces one at a time with a real script,
  not one giant query.

## Step 2 — Remove public/state/government/political entities

Script: `scripts/cleanup-public-entities.ts`

Runs a keyword classifier against every company **name** (not the `category`
field the seed script assigned — category was a rough OSM-tag-derived guess,
not authoritative). Order of evaluation matters: **exemptions are checked
before removal keywords**, so a private entity that happens to contain a
government-sounding word is protected.

**Removal categories and keywords** (Unicode-boundary word matching, not
substring — see below for why):
- **Government Agencies**: Valiliği, Kaymakamlığı, Belediyesi, Belediye,
  Bakanlığı, Müdürlüğü, Müdürlük, Nüfus Müdürlüğü, Vergi Dairesi, SGK,
  Emniyet, Polis, Jandarma, Adliye, Adliyesi, Adalet Sarayı, Mahkemesi, Tapu
  Müdürlüğü, Tapu Kadastro, Muhtarlığı, Müftülüğü, İSKİ, İZSU, ASKİ, OSB
  Müdürlüğü
- **Notaries**: Noter, Noteri, Noterliği, Noterlik, Noter Masası — **missed
  entirely in the first pass on Istanbul** (74 slipped through; notaries are
  a Ministry-of-Justice-appointed legal function, same civil-service bucket
  as the rest of this list even though a noter is technically
  self-employed). Add this category from the start on future provinces.
- **Political Parties**: Partisi, Parti, İl Başkanlığı, İlçe Başkanlığı,
  Gençlik Kolları, Kadın Kolları, Siyasi Parti, AK Parti, AKP, CHP, MHP, İYİ
  Parti, DEM Parti, Saadet Partisi, DEVA Partisi, Gelecek Partisi.
  **Deliberately excludes "Temsilciliği"** (representative office) — equally
  common as private-company terminology for a distributor/regional rep
  office (e.g. a car brand's local dealership), the exact same ambiguity
  "Genel Müdürlük" turned out to have. Any real "Temsilciliği" match needs
  the same one-by-one manual review as the Genel Müdürlük case, not a blind
  keyword add. Also still not comprehensive for party-adjacent entities more
  generally — "1920 TKP Kadıköy İlçe Örgütü" (a Communist Party district
  *organization* office) survived both passes since "İlçe Örgütü" isn't yet
  a listed keyword, only "İlçe Başkanlığı" is.
- **Public Schools**: İlkokulu, İlköğretim Okulu, Ortaokulu, Anadolu Lisesi,
  Fen Lisesi, İmam Hatip Lisesi, Mesleki ve Teknik Anadolu Lisesi, Devlet
  Üniversitesi, Fakültesi, Rektörlüğü, Halk Eğitim Merkezi, RAM
- **Public Hospitals**: Devlet Hastanesi, Şehir Hastanesi, Eğitim ve
  Araştırma Hastanesi, Aile Sağlığı Merkezi, ASM, Toplum Sağlığı Merkezi,
  Ağız ve Diş Sağlığı Merkezi, ADSM, Sağlık Ocağı, Verem Savaş, Aşılama
  Merkezi
- **Private exemptions (checked first)**: Özel, Ozel, Kolej, Koleji, Vakıf
  Üniversitesi, Dershanesi, Sürücü Kursu, Öğretim Kursu, Kreş, Anaokulu,
  Özel Hastane, Özel Tıp Merkezi, Özel Poliklinik, Özel Ağız ve Diş Sağlığı,
  Diş Kliniği, Özel Sağlık Kabini, Vakıf Hastanesi

**Critical implementation detail — word-boundary matching, not
`.includes()`**: a naive substring check false-positives constantly on short
keywords embedded inside unrelated words. Verified failures before this fix:
"RAM" matched inside "A**ram**a" (a search-and-rescue NGO's name), "ASM"
matched inside "**Asm**a Ambalaj" (a packaging company), "ASKİ" matched
inside "B**aski**" ("printing"). Fix: same Unicode-boundary regex as the
personal-name filter above,
`(?<![\p{L}\p{N}])${escapedKeyword}(?![\p{L}\p{N}])` with the `u` flag.

**Known noisy keyword — "Müdürlük"/"Müdürlüğü"**: this is ordinary Turkish
corporate-HQ terminology ("Genel Müdürlük" = "head office"), not exclusively
governmental — private companies' Istanbul HQ listings (HSBC, Koton, Bosch,
Çimsa, İpragaz, UPS, MNG Kargo, İpekyol, Hyundai [distributor], Gülaylar,
Hedef Filo, Akçansa all showed up this way) match it just as often as real
government directorates do. **Do not auto-delete matches on this keyword
alone** — flag them separately from confident matches (everything else) and
review each one manually. For Istanbul, this review found true genuinely
public entities (Milli Eğitim Müdürlüğü, Sağlık Müdürlüğü, İl Göç İdaresi,
KYK/YÖK dormitory offices, TCDD, Bağkur, Basın İlan Kurumu, KİPTAŞ [a
metropolitan-municipality-owned construction company], Türkiye Denizcilik
İşletmeleri) mixed in with the private false positives above. A few
ownership calls are genuinely ambiguous and worth flagging for human
judgment rather than guessing — e.g. a privatized former state utility
(BEDAŞ/Boğaziçi Elektrik Dağıtım, sold off in a 2013 privatization but still
a regulated distribution monopoly) or a bank majority-owned by a state
foundation (Vakıf Katılım, owned by Vakıflar Genel Müdürlüğü but operating
as an ordinary commercial bank).

**Also caught in review, not by any keyword flaw specifically but worth
double-checking generally**: a labor union ("Belediye-İş Sendikası") matched
on "Belediye" as a literal name prefix despite being an independent worker
organization, not a government office. Keyword hits deserve a skim even when
they look unambiguous.

**Deletion mechanics**: hard delete (this schema has no soft-delete /
`is_active` field — matches how the earlier test-data purge was done), in
FK-dependency order inside a single `$transaction`: ReviewVote →
ModerationQueueItem → Review → CompanyOwner → OwnerContactMessage →
CompanyAggregateScore → EmploymentHistory → Company. Freshly-seeded OSM
companies should have zero reviews/employment history, but delete
defensively in case anyone interacted with one since import.

## Step 3 — Normalize name text quality

Script: `scripts/normalize-company-names.ts`

OSM names arrive with inconsistent casing (some ALL CAPS, some
lowercase-first) and Turkish diacritics frequently flattened to ASCII
("Altin" instead of "Altın"). This step fixes both, with several
non-obvious rules learned from a full manual review of every proposed change
on Istanbul's dataset (~750 changes, individually read start to finish
before trusting any of it):

- **Diacritic restoration** uses the `turkish-deasciifier` npm package (a JS
  port of Dr. Deniz Yuret's statistical Turkish deasciifier — same algorithm
  family as Zemberek). It's context-aware and gets the large majority of
  cases right, but **it is not purely additive** — running it on a word that
  is *already* correctly accented can "correct" it into something wrong
  (verified regressions: already-correct "Mektüm" → "Mektum", "Erenköy" (a
  real neighborhood) → "Erenkoy", "Akçansa" (a real company) → "Akcansa").
  **Fix: only run a word through the deasciifier if it is currently pure
  ASCII** (contains none of ı/İ/ş/Ş/ç/Ç/ğ/Ğ/ö/Ö/ü/Ü already) — words that
  already have any Turkish-specific letter are left completely alone.
- **Even pure-ASCII words carry residual risk**: short common words with two
  valid Turkish readings are the model's weak point ("su"/water guessed as
  "şu"/that; "ali"/a name guessed as "alı"; "adli"/judicial guessed as
  "adlı"/named; "isi"/heat guessed wrong entirely). Also occasionally
  mis-guesses real proper nouns/brands ("Battalgazi" — a real place name —
  → "Battalgazı"; "Basko" — a real supermarket chain — → "Başko") and tries
  to "Turkify" English loanwords mixed into a name ("International" →
  "İnternational"). **There is no clean algorithmic fix for this category —
  it requires reading the diff and building a small denylist of specific
  words to leave untouched as you find them** (see `NEVER_DEASCIIFY` in the
  script for the ones found on Istanbul's set).
- **Capitalization**: Title Case (first letter up, rest down) per word,
  Turkish-locale-aware (`toLocaleUpperCase("tr-TR")`/`toLocaleLowerCase("tr-TR")`,
  not the plain ASCII methods — Turkish's dotted/dotless I distinction
  breaks under default JS casing). Short conjunctions (ve, ile, veya, da,
  de, ya, ki) stay lowercase mid-name per TDK convention (matches "and"/"of"
  staying lowercase in an English title) — except as the very first word.
- **Acronym/brand-signature preservation**: a word that is short (2-6
  letters) and was *already fully uppercase* in the source is treated as an
  intentional brand acronym or legal abbreviation and left completely
  untouched, rather than forced to Title Case (which would turn "ADT" into
  "Adt", destroying the brand's actual identity). This applies:
  - **Unconditionally** to a small whitelist of known Turkish corporate/legal
    suffixes (A.Ş., LTD., ŞTİ., A.O., T.C., etc.) — these are conventionally
    written in caps with periods regardless of surrounding text, wherever
    they appear in a name.
  - **At any word position** for a short all-caps token, e.g. parenthetical
    acronyms explaining an abbreviation mid-name ("(İŞKUR)", "(F.A.S.T.)",
    "(WALD)") — not just the first word.
  - **At first-word position specifically, only when the whole name has
    fewer than 4 words** — a first word that short in a longer, more
    descriptive name is less likely to be a standalone brand acronym. (This
    threshold came directly from the person requesting this feature, using
    "ADT Dedektiflik" as the motivating example.)
  - **Gated by a "is the whole name shouting?" check**: if literally every
    letter in the name is already uppercase, don't treat any individual
    short word as a special acronym — normalize the whole thing. Without
    this gate, a fully-caps name like "2M ENDÜSTRİYEL... SAN. VE DIŞ TİC.
    LTD. ŞTİ" kept "SAN"/"VE"/"DIŞ"/"TİC" stuck in caps, since each one
    individually looked like a short acronym purely because nothing else in
    the name had lowercase letters to contrast against.
- **Multi-run compound tokens** (hyphens, periods, slashes, ampersands
  gluing sub-words together with no space — "Bd.Asya", "İnşaat-Emlak",
  "kiralık.satılık") need the capital-letter rule applied to *every*
  letter-run in the token, not just the token's very first character — a
  naive "capitalize index 0, lowercase the rest" turns "Bd.Asya" into
  "Bd.asya". Exceptions within this: single-letter runs (usually a
  grammatical particle glued on, e.g. "Bab-ı" — capitalizing the "ı" to "I"
  reads wrong), a letter-run immediately after an apostrophe (Turkish never
  capitalizes a case-suffix glued on that way — "Mahir'de", "Kur'an"), and
  domain-style TLDs after a literal period ("e-makarna.**com**", not
  "...Com" — small fixed list: com/net/org/co/info/biz/tr/gov/edu).
- **Unicode normalization**: run `.normalize("NFC")` on the name before
  anything else. Dotted Turkish İ can arrive as either the single
  precomposed codepoint or as "i" + a combining dot-above mark — visually
  identical, but the latter makes any regex-based letter-run splitting see
  two runs instead of one, corrupting the result (observed: "Ci̇hat" →
  "Çi̇Hat").
- **Known accepted limitation — CamelCase brand names**: a single
  whitespace-delimited "word" with intentional internal capitalization
  ("GetirOfis", "ÇetinKaya", "MarcoPlas") gets flattened to plain Title Case
  ("Getirofis", "Çetinkaya", "Marcoplas") since there's no space/punctuation
  boundary for the multi-run logic to key off. This is a stylistic
  simplification, not a correctness regression, and was accepted as a
  reasonable trade-off rather than solved (solving it would require
  detecting "is this internal capital intentional branding" — no reliable
  signal for that beyond a hardcoded per-brand list).
- **Protect already-hand-reviewed names**: any company name individually
  vetted during Step 2's manual "Genel Müdürlük" review (kept-as-private
  companies whose brand-initial first word doesn't happen to already be
  stored in all-caps — e.g. "Asm İnşaat", stored as mixed-case "Asm" — so it
  wouldn't otherwise qualify for the signature-acronym exception above) must
  be listed verbatim in `SKIP_ENTIRELY` so this pass doesn't silently undo
  that review.

**Dry run first, always** — run without `--apply`, read the *entire* diff
(not a sample) before trusting it, since the residual-risk categories above
are specific enough that a full read is the only reliable way to catch them.
`--apply` writes every proposed change in one pass once you're satisfied.

## Rejected approach — Google Places cross-verification / "no legal suffix = fake"

A later request asked for every company to be cross-checked against Google
Places API (operational status, verified coordinates/address, stored
`google_place_id`) and for entries lacking a corporate legal suffix (A.Ş.,
LTD. ŞTİ.) with zero Google Maps presence to be purged as "fake/made-up."
Both were declined for this dataset:

- **No Google Maps/Places API key exists anywhere in this project** (only
  `GOOGLE_CLIENT_ID` for Sign-In OAuth, unrelated and unset). Places API is a
  paid, metered Google Cloud service — running it across the full directory
  means real per-query billing, and Google's Maps Platform ToS has specific
  restrictions on how long most Place Details fields can be cached/stored
  outside of live map display. This needs a deliberate decision (get a key,
  confirm budget, confirm the storage approach fits the ToS) before any code
  gets written against it, not an assumption.
- **"No legal suffix = presumptively fake" would gut the real directory.**
  Measured directly on Istanbul's post-cleanup data: **1,712 of 1,748
  companies (98%) have no corporate legal suffix** — completely normal,
  since Turkish sole proprietorships (the overwhelming norm for small trade
  businesses: electricians, jewelers, photographers, real estate agents)
  don't carry an A.Ş./LTD. ŞTİ. suffix at all. This heuristic would flag
  nearly the entire OSM-sourced dataset, not actual fakes.
- **The junk/troll/test-name pattern scan (Test, Demo, Asdf, Deneme, Lorem
  Ipsum, etc.) is still worth running** — it's cheap and has zero
  false-positive risk once you check word-boundary matches, not substrings
  ("Testaş" and "Demokrasi" both contain "test"/"demo" as substrings but
  aren't test data). It found nothing on Istanbul, which makes sense: OSM
  data isn't user-typed free text the way an admin form submission would be,
  so troll/joke names aren't really a risk vector for this pipeline the way
  they would be for user-generated content elsewhere in the app.

## What this deliberately does NOT do

- **No phone/email/address/lat-lng collection.** `Company` has no columns
  for these today, and adding them would be a schema change. More
  importantly: scraping and republishing real businesses' phone/email at
  scale is a genuine KVKK (Turkish data protection law) question that a
  keyword filter cannot resolve, and this platform's review flow doesn't
  functionally need scraped contact data anyway — reviews are about
  workplace culture, not a business directory listing.
- **No claim of KVKK/legal compliance for anything in this pipeline.** The
  personal-name filter and corporate-indicator checks are data-quality
  heuristics for keeping the directory populated with actual employers, not
  a legal compliance mechanism.
- **No nationwide single-query Overpass calls.** Fair-use limits on the
  public API make that impractical regardless of legal considerations — loop
  provinces one at a time.
