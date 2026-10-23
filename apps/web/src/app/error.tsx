"use client";

import { useEffect } from "react";
import { ERROR_PRIMARY_BUTTON, ERROR_SECONDARY_BUTTON, ErrorScreen } from "@/components/errors/ErrorScreen";
import { ERROR_SCREEN_ART } from "@/lib/errorScreens";
import { useT } from "@/lib/i18n/client";

/**
 * A page broke while loading or showing. Replaces only the page area: the
 * header, footer and chat dock stay, so the visitor can carry on from there.
 * "Try again" re-loads just this page's content.
 */
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();

  useEffect(() => {
    // Shows up in the browser console; the server logs its own side with the
    // same digest.
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      eyebrow={t("Something went wrong")}
      title={t("This page stopped working.")}
      body={t("It's on our side, not yours. Try again, and if it keeps happening, come back in a few minutes.")}
      art={ERROR_SCREEN_ART.crash}
      artAlt=""
      actions={
        <>
          <button type="button" onClick={() => retry()} className={ERROR_PRIMARY_BUTTON}>
            {t("Try again")}
          </button>
          {/* A plain link, not the client router: a full load starts clean. */}
          <a href="/" className={ERROR_SECONDARY_BUTTON}>
            {t("Go to the homepage")}
          </a>
        </>
      }
    />
  );
}
