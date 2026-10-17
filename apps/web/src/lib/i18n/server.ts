import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, makeTranslator, type Locale, type Translator } from "./core";
import { TR } from "./tr";

// The visitor's language for a Server Component: the cookie the Language
// setting writes, English when there is none.
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
}

export async function getTranslator(): Promise<Translator> {
  const locale = await getLocale();
  return makeTranslator(locale, locale === "tr" ? TR : null);
}

export { TR };
