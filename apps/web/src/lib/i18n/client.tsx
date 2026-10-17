"use client";

import { createContext, useCallback, useContext, useMemo, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, makeTranslator, type Dictionary, type Locale, type Translator } from "./core";

interface I18nValue extends Translator {
  setLocale: (next: Locale) => void;
  switching: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

// One year; the choice belongs to this browser, like the theme.
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

/**
 * Holds the language the root layout read from the cookie and, for Turkish
 * only, the dictionary (so an English visitor never downloads it). Switching
 * writes the cookie and asks the server to render the page again; the root
 * layout then hands down the other language.
 */
export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary | null; children: ReactNode }) {
  const router = useRouter();
  const [switching, startTransition] = useTransition();

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${COOKIE_MAX_AGE_S}; SameSite=Lax`;
      document.documentElement.lang = next;
      startTransition(() => router.refresh());
    },
    [router],
  );

  const value = useMemo<I18nValue>(() => ({ ...makeTranslator(locale, dict), setLocale, switching }), [locale, dict, setLocale, switching]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Outside the provider (a component rendered on its own in a test) the
// English text is used as-is.
const FALLBACK: I18nValue = { ...makeTranslator("en", null), setLocale: () => undefined, switching: false };

export function useI18n(): I18nValue {
  return useContext(I18nContext) ?? FALLBACK;
}

// Shorthand for components that only need the text.
export function useT(): Translator["t"] {
  return useI18n().t;
}
