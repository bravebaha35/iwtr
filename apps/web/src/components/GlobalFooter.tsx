"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PricingComparisonTable } from "@/components/PricingComparisonTable";
import { KVKKModal } from "@/components/legal/KVKKModal";
import { NoticeTakedownModal } from "@/components/legal/NoticeTakedownModal";
import { AnonymityPolicyModal } from "@/components/legal/AnonymityPolicyModal";
import { useT } from "@/lib/i18n/client";

// Sentinel hrefs, not real routes — caught below and opened as a popup
// instead of navigated to. Pricing is deliberately not a page (see
// PricingComparisonTable's own comment); the four Legal/Anonymity links use
// the same trick now that each opens a modal (TermsModal/KVKKModal/
// NoticeTakedownModal/AnonymityPolicyModal) instead of routing to a
// separate static page.
const PRICING_HREF = "#pricing";
const KVKK_HREF = "#kvkk";
const NOTICE_TAKEDOWN_HREF = "#notice-takedown";
const ANONYMITY_HREF = "#anonymity";

// Real navigations (not popups) that also carry a `?highlight=` flag —
// WorkplaceBrowser.tsx reads it on arrival and plays a one-shot pulse/glow
// on the control being pointed at (see its HighlightParamListener and
// globals.css's .highlight-pulse), so landing on the homepage from one of
// these links comes with a visual "look here" instead of a bare redirect.
const HOME_HIGHLIGHT_SEARCH_HREF = "/?highlight=search";
const HOME_HIGHLIGHT_CATEGORIES_HREF = "/?highlight=categories";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

// Deliberately always a dark band (the fixed Slate Dam `bg-footer` token —
// the settings sidebars have their own theme-aware one), not the theme's
// `bg-background`/`border-border` variables — unlike the rest of the app,
// this footer stays dark in both light and dark mode. That's the explicit
// design brief, not an oversight.
//
// Real destinations only where a page already exists today. Submit a
// Review, Job Categories, and Claim Profile all point at the homepage
// (where the review flow and the category-group filter actually live),
// each with its own highlight flag so arrival isn't a bare, unexplained
// redirect; HR Dashboard -> /my/companies, the existing owner dashboard.
// Anonymity Policy and the three Legal links open a modal instead of
// routing anywhere (TermsModal/KVKKModal/NoticeTakedownModal/
// AnonymityPolicyModal in components/legal/) via the same sentinel-href
// trick PRICING_HREF already uses.
const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Platform",
    links: [
      { label: "Submit a Review", href: HOME_HIGHLIGHT_SEARCH_HREF },
      { label: "Job Categories", href: HOME_HIGHLIGHT_CATEGORIES_HREF },
      { label: "Anonymity Policy", href: ANONYMITY_HREF },
    ],
  },
  {
    title: "Employers",
    links: [
      { label: "Claim Profile", href: HOME_HIGHLIGHT_SEARCH_HREF },
      { label: "HR Dashboard", href: "/my/companies" },
      { label: "Pricing", href: PRICING_HREF },
    ],
  },
  {
    title: "Legal",
    links: [
      // Full pages (not popups) so they can be linked to, indexed and read
      // comfortably on a phone.
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms & Conditions", href: "/terms" },
      { label: "KVKK Aydınlatma Metni", href: KVKK_HREF },
      { label: "Notice & Takedown (Uyar-Kaldır)", href: NOTICE_TAKEDOWN_HREF },
    ],
  },
];

export function GlobalFooter() {
  const [showPricing, setShowPricing] = useState(false);
  const [showKvkk, setShowKvkk] = useState(false);
  const [showNoticeTakedown, setShowNoticeTakedown] = useState(false);
  const [showAnonymity, setShowAnonymity] = useState(false);
  const t = useT();

  // Every sentinel href opens a popup instead of navigating — this map is
  // the one place that decides which, so a link renders as a <button> (see
  // below) whenever its href has an opener here, and a plain <Link>
  // otherwise (including the HOME_HIGHLIGHT_* hrefs, which are real
  // navigations and so are never in this map).
  const popupOpeners: Record<string, () => void> = {
    [PRICING_HREF]: () => setShowPricing(true),
    [KVKK_HREF]: () => setShowKvkk(true),
    [NOTICE_TAKEDOWN_HREF]: () => setShowNoticeTakedown(true),
    [ANONYMITY_HREF]: () => setShowAnonymity(true),
  };

  const linkClass =
    "inline-block bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 text-[15px] text-footer-foreground/70 transition-[color,background-size] duration-300 ease-out hover:bg-[length:100%_1px] hover:text-footer-foreground focus-visible:bg-[length:100%_1px] focus-visible:text-footer-foreground focus-visible:outline-none motion-reduce:transition-none";

  return (
    // A dark sheet with rounded top corners, laid over the end of the page.
    <footer className="mt-auto rounded-t-[2rem] border-t border-white/[0.07] bg-footer">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-12 px-6 pb-14 pt-16 sm:px-8 lg:grid-cols-12 lg:gap-x-10">
        <div className="col-span-2 lg:col-span-4">
          <Link href="/" className="group inline-flex items-center gap-3.5">
            <Image
              src="/brand-mark.png"
              alt=""
              width={96}
              height={96}
              sizes="48px"
              className="h-12 w-12 shrink-0 object-contain transition-transform duration-500 ease-out group-hover:-rotate-6 motion-reduce:transition-none"
            />
            <span className="font-display text-[1.75rem] leading-none tracking-tight text-footer-foreground">I Worked There</span>
          </Link>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <nav
            key={column.title}
            aria-label={t(column.title)}
            className={column.title === "Legal" ? "col-span-2 sm:col-span-1 lg:col-span-4" : "col-span-1 lg:col-span-2"}
          >
            <h2 className="font-display text-sm font-semibold text-footer-foreground/50">{t(column.title)}</h2>
            <ul className="mt-5 space-y-3.5">
              {column.links.map((link) => {
                const openPopup = popupOpeners[link.href];
                return (
                  <li key={link.label}>
                    {openPopup ? (
                      <button type="button" onClick={openPopup} className={`${linkClass} text-left`}>
                        {t(link.label)}
                      </button>
                    ) : (
                      <Link href={link.href} className={linkClass}>
                        {t(link.label)}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <p className="border-t border-white/10 py-7 text-sm text-footer-foreground/55">
          &copy; 2026 iworkedthere.com. {t("All rights reserved.")}
        </p>
      </div>

      {showPricing && <PricingComparisonTable onClose={() => setShowPricing(false)} />}
      {showKvkk && <KVKKModal onClose={() => setShowKvkk(false)} />}
      {showNoticeTakedown && <NoticeTakedownModal onClose={() => setShowNoticeTakedown(false)} />}
      {showAnonymity && <AnonymityPolicyModal onClose={() => setShowAnonymity(false)} />}
    </footer>
  );
}
