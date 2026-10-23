import type { Metadata } from "next";
import { MagneticLink } from "@/components/motion/MagneticLink";
import { ERROR_PRIMARY_BUTTON, ErrorScreen } from "@/components/errors/ErrorScreen";
import { ERROR_SCREEN_ART } from "@/lib/errorScreens";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("Page not found"), robots: { index: false } };
}

/** 404: the address leads nowhere. Exactly one way out. */
export default async function NotFound() {
  const { t } = await getTranslator();
  return (
    <ErrorScreen
      eyebrow={t("Error 404")}
      title={t("This page never worked here.")}
      body={t("The link may be old, or the page may have moved. Everything you were looking for is still a click away.")}
      art={ERROR_SCREEN_ART.notFound}
      artAlt={t("A thoughtful beaver scratching its head")}
      actions={
        <MagneticLink href="/" className={ERROR_PRIMARY_BUTTON}>
          {t("Return to Dashboard")}
          <span aria-hidden="true">→</span>
        </MagneticLink>
      }
    />
  );
}
