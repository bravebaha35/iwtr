"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { WebsiteRulesModal } from "@/components/WebsiteRulesModal";
import { useT } from "@/lib/i18n/client";

/**
 * Blocks a page's real content from a logged-out visitor, showing a Register
 * prompt instead. Used by the homepage and IWT Social — both were public,
 * read-only browsing by earlier design; this is a deliberate later product
 * decision to require an account before either is visible at all.
 *
 * The prompt is the site's front door for anyone without an account, so it
 * is a full first screen: the message and Register on the left, the three
 * working beavers on the right. `below` adds further sections under it
 * (the homepage passes its explainer sections; IWT Social passes nothing).
 */
export function AnonGate({
  title,
  description,
  children,
  assumeAnonymous = false,
  below,
}: {
  title: string;
  description: string;
  children: ReactNode;
  // Set by a server component that saw no session cookie at all: the visitor
  // is certainly logged out, so the register prompt is rendered right away
  // (server-side, part of the first paint) instead of after the browser's
  // own session check.
  assumeAnonymous?: boolean;
  // Extra sections shown under the prompt, to logged-out visitors only.
  below?: ReactNode;
}) {
  const { isLoading, isAuthenticated, openAuthModal } = useAuth();
  const [rulesOpen, setRulesOpen] = useState(false);
  const t = useT();

  if (isLoading && !assumeAnonymous) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("Loading...")}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="w-full">
        <section className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-10 px-4 pb-16 pt-10 sm:px-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-14 md:pb-24 md:pt-20">
          <div>
            <h1 className="max-w-[16ch] text-4xl leading-[1.05] text-foreground sm:text-5xl lg:text-[3.5rem]">{t(title)}</h1>
            <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-muted-foreground">{t(description)}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => openAuthModal("register")}
                className="rounded-full bg-brand-600 px-7 py-3 text-base font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]"
              >
                {t("Register")}
              </button>
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="rounded-full bg-surface-muted px-6 py-3 text-base font-medium text-foreground transition hover:bg-border/70 active:scale-[0.98]"
              >
                {t("How it works")}
              </button>
            </div>
          </div>
          <Image
            src="/IWT%20Intro%20Real.png"
            width={1264}
            height={848}
            sizes="(min-width: 768px) 640px, 100vw"
            priority
            alt={t("Three beavers at work: one in a suit taking notes, one in a hard hat carrying pipes, one welding.")}
            className="h-auto w-full max-w-[640px] justify-self-center object-contain md:justify-self-end"
          />
        </section>

        {below}

        {rulesOpen && (
          <WebsiteRulesModal
            onClose={() => setRulesOpen(false)}
            onRegister={() => {
              setRulesOpen(false);
              openAuthModal("register");
            }}
          />
        )}
      </div>
    );
  }

  return <>{children}</>;
}
