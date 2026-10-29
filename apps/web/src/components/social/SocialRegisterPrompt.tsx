"use client";

import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/client";

/**
 * Shown in place of a company's Social tab to a logged-out visitor. IWT Social
 * is for members only (the API refuses logged-out reads), so instead of an
 * empty or broken tab the visitor gets a short reason to register - and the
 * promise that their name is never shown.
 */
export function SocialRegisterPrompt({ companyName }: { companyName: string }) {
  const { openAuthModal } = useAuth();
  const t = useT();
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-8 rounded-2xl bg-surface px-6 py-10 text-center shadow-xs sm:flex-row sm:px-10 sm:text-left">
      <Image
        src="/IWT%20Intro%20Real.png"
        width={1264}
        height={848}
        sizes="240px"
        alt=""
        className="h-auto w-48 shrink-0 object-contain sm:w-60"
      />
      <div>
        <h2 className="text-2xl leading-tight text-foreground sm:text-3xl">
          {t("See what {company} shares on IWT Social", { company: companyName })}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {t("Posts, photos and questions are for members. Registering is free, and companies never see who you are.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
          <button
            type="button"
            onClick={() => openAuthModal("register")}
            className="rounded-full bg-brand-600 px-6 py-2.5 text-[15px] font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]"
          >
            {t("Register")}
          </button>
          <button
            type="button"
            onClick={() => openAuthModal("login")}
            className="rounded-full bg-surface-muted px-6 py-2.5 text-[15px] font-medium text-foreground transition hover:bg-border/70 active:scale-[0.98]"
          >
            {t("Log in")}
          </button>
        </div>
      </div>
    </section>
  );
}
