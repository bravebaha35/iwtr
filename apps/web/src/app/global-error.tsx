"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ERROR_PRIMARY_BUTTON, ErrorScreen } from "@/components/errors/ErrorScreen";
import { ERROR_SCREEN_ART } from "@/lib/errorScreens";
import { LOCALE_COOKIE } from "@/lib/i18n/core";
import "./globals.css";

// Shown only when the site as a whole failed (the root layout itself broke),
// so the header, fonts, theme script and translation dictionary are all
// missing here. The colours still come from globals.css; the language and
// the dark theme are read straight from the browser, and the few words this
// screen needs are kept in this file in both languages.
const TEXT = {
  en: {
    eyebrow: "Something went wrong",
    title: "The site couldn't load.",
    body: "It's on our side, not yours. Try again in a moment.",
    retry: "Try again",
  },
  tr: {
    eyebrow: "Bir şeyler ters gitti",
    title: "Site yüklenemedi.",
    body: "Sorun bizde, sende değil. Birazdan tekrar dene.",
    retry: "Tekrar dene",
  },
} as const;

function prefersDark(): boolean {
  try {
    const theme = localStorage.getItem("iwtr:theme");
    return theme === "dark" || (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  } catch {
    return false;
  }
}

function readBrowser(): string {
  const tr = document.cookie.split("; ").includes(`${LOCALE_COOKIE}=tr`);
  return `${tr ? "tr" : "en"}|${prefersDark() ? "dark" : "light"}`;
}

// Read once from the browser; the server render (if any) uses English + light.
const subscribe = () => () => {};

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [lang, theme] = useSyncExternalStore(subscribe, readBrowser, () => "en|light").split("|") as ["en" | "tr", string];
  const dark = theme === "dark";

  useEffect(() => {
    console.error(error);
  }, [error]);

  const text = TEXT[lang];

  return (
    <html lang={lang} className={dark ? "dark h-full" : "h-full"}>
      <head>
        <title>I Worked There</title>
        <meta name="robots" content="noindex" />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground antialiased">
        <ErrorScreen
          eyebrow={text.eyebrow}
          title={text.title}
          body={text.body}
          art={ERROR_SCREEN_ART.siteDown}
          artAlt=""
          actions={
            <button type="button" onClick={() => retry()} className={ERROR_PRIMARY_BUTTON}>
              {text.retry}
            </button>
          }
        />
      </body>
    </html>
  );
}
