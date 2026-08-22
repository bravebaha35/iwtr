import { TURKEY_PROVINCES, normalizeCityName, type TurkeyProvince } from "./turkey";

// Official PSTN (landline) area codes for all 81 Turkish provinces, keyed by
// the same `plate` (license-plate) number TURKEY_PROVINCES uses — plate is a
// stable 01-81 join key, safer than joining on province name spelling.
// Every province has exactly one code except İstanbul (34), which is split
// across two: 212 (European side) and 216 (Asian side). Stored WITHOUT the
// leading trunk "0" — display formatting (formatTurkishLandline in
// schemas/turkishPhone.ts) adds it back; kept bare here so a code can be
// compared directly against the digits parsed out of an E.164 number.
export const TURKEY_AREA_CODES_BY_PLATE: Record<string, string[]> = {
  "01": ["322"], "02": ["416"], "03": ["272"], "04": ["472"], "05": ["358"],
  "06": ["312"], "07": ["242"], "08": ["466"], "09": ["256"], "10": ["266"],
  "11": ["228"], "12": ["426"], "13": ["434"], "14": ["374"], "15": ["248"],
  "16": ["224"], "17": ["286"], "18": ["376"], "19": ["364"], "20": ["258"],
  "21": ["412"], "22": ["284"], "23": ["424"], "24": ["446"], "25": ["442"],
  "26": ["222"], "27": ["342"], "28": ["454"], "29": ["456"], "30": ["438"],
  "31": ["326"], "32": ["246"], "33": ["324"], "34": ["212", "216"], "35": ["232"],
  "36": ["474"], "37": ["366"], "38": ["352"], "39": ["288"], "40": ["386"],
  "41": ["262"], "42": ["332"], "43": ["274"], "44": ["422"], "45": ["236"],
  "46": ["344"], "47": ["482"], "48": ["252"], "49": ["436"], "50": ["384"],
  "51": ["388"], "52": ["452"], "53": ["464"], "54": ["264"], "55": ["362"],
  "56": ["484"], "57": ["368"], "58": ["346"], "59": ["282"], "60": ["356"],
  "61": ["462"], "62": ["428"], "63": ["414"], "64": ["276"], "65": ["432"],
  "66": ["354"], "67": ["372"], "68": ["382"], "69": ["458"], "70": ["338"],
  "71": ["318"], "72": ["488"], "73": ["486"], "74": ["378"], "75": ["478"],
  "76": ["476"], "77": ["226"], "78": ["370"], "79": ["348"], "80": ["328"],
  "81": ["380"],
};

// Flat, de-duplicated set of every valid landline area code in the country —
// used to validate a landline number's area code without needing to know
// which province it claims to be from (e.g. a company headquartered in one
// city legitimately using another city's line).
export const ALL_TURKEY_AREA_CODES: readonly string[] = Array.from(
  new Set(Object.values(TURKEY_AREA_CODES_BY_PLATE).flat()),
).sort();

const PLATE_BY_NORMALIZED_PROVINCE_NAME = new Map(
  TURKEY_PROVINCES.map((p) => [normalizeCityName(p.name), p.plate]),
);

const PLATE_BY_AREA_CODE = new Map(
  Object.entries(TURKEY_AREA_CODES_BY_PLATE).flatMap(([plate, codes]) => codes.map((code) => [code, plate])),
);
const PROVINCE_BY_PLATE = new Map(TURKEY_PROVINCES.map((p) => [p.plate, p]));

// Reverse lookup: which province does this landline area code belong to?
// Used by the "pick a province, the area code follows and is locked" phone
// picker (TurkishPhoneInput) to figure out which province is currently
// selected from a phone number's own digits, without keeping a separate
// province field on the form.
export function provinceForAreaCode(areaCode: string): TurkeyProvince | null {
  const plate = PLATE_BY_AREA_CODE.get(areaCode);
  if (!plate) return null;
  return PROVINCE_BY_PLATE.get(plate) ?? null;
}

// Landline area code(s) for a province, resolved the same
// case/diacritic-insensitive way findProvinceByCityName already does — so a
// stored Company.city value (already canonicalized by resolveLocation) reliably
// resolves here too. Returns null for an unrecognized province name.
export function areaCodesForProvince(provinceName: string | null | undefined): string[] | null {
  if (!provinceName) return null;
  const plate = PLATE_BY_NORMALIZED_PROVINCE_NAME.get(normalizeCityName(provinceName));
  if (!plate) return null;
  return TURKEY_AREA_CODES_BY_PLATE[plate] ?? null;
}
