"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PricingComparisonTable } from "@/components/PricingComparisonTable";
import { TermsModal } from "@/components/legal/TermsModal";
import { KVKKModal } from "@/components/legal/KVKKModal";
import { NoticeTakedownModal } from "@/components/legal/NoticeTakedownModal";
import { AnonymityPolicyModal } from "@/components/legal/AnonymityPolicyModal";

// Sentinel hrefs, not real routes — caught below and opened as a popup
// instead of navigated to. Pricing is deliberately not a page (see
// PricingComparisonTable's own comment); the four Legal/Anonymity links use
// the same trick now that each opens a modal (TermsModal/KVKKModal/
// NoticeTakedownModal/AnonymityPolicyModal) instead of routing to a
// separate static page.
const PRICING_HREF = "#pricing";
const TERMS_HREF = "#terms";
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

// Deliberately always the obsidian/zinc palette (bg-zinc-950 etc.), not the
// theme's `bg-background`/`border-border` variables — unlike the rest of the
// app, this footer band doesn't switch with the light/dark toggle. That's
// the explicit design brief, not an oversight.
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
      { label: "Terms of Service", href: TERMS_HREF },
      { label: "KVKK Aydınlatma Metni", href: KVKK_HREF },
      { label: "Notice & Takedown (Uyar-Kaldır)", href: NOTICE_TAKEDOWN_HREF },
    ],
  },
];

export function GlobalFooter() {
  const [showPricing, setShowPricing] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showKvkk, setShowKvkk] = useState(false);
  const [showNoticeTakedown, setShowNoticeTakedown] = useState(false);
  const [showAnonymity, setShowAnonymity] = useState(false);

  // Every sentinel href opens a popup instead of navigating — this map is
  // the one place that decides which, so a link renders as a <button> (see
  // below) whenever its href has an opener here, and a plain <Link>
  // otherwise (including the HOME_HIGHLIGHT_* hrefs, which are real
  // navigations and so are never in this map).
  const popupOpeners: Record<string, () => void> = {
    [PRICING_HREF]: () => setShowPricing(true),
    [TERMS_HREF]: () => setShowTerms(true),
    [KVKK_HREF]: () => setShowKvkk(true),
    [NOTICE_TAKEDOWN_HREF]: () => setShowNoticeTakedown(true),
    [ANONYMITY_HREF]: () => setShowAnonymity(true),
  };

  return (
    <footer className="mt-auto border-t border-zinc-800 bg-zinc-950">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-12 sm:grid-cols-3">
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-50">{column.title}</h3>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => {
                const openPopup = popupOpeners[link.href];
                return openPopup ? (
                  <li key={link.label}>
                    <button
                      type="button"
                      onClick={openPopup}
                      className="text-sm text-zinc-400 transition hover:text-zinc-50"
                    >
                      {link.label}
                    </button>
                  </li>
                ) : (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-zinc-400 transition hover:text-zinc-50">
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 border-t border-zinc-800 px-6 py-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-sm font-semibold text-zinc-50">I Worked There</span>
        </div>
        <p className="text-sm text-zinc-400">&copy; 2026 iworkedthere.com. All rights reserved.</p>
      </div>

      {showPricing && <PricingComparisonTable onClose={() => setShowPricing(false)} />}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showKvkk && <KVKKModal onClose={() => setShowKvkk(false)} />}
      {showNoticeTakedown && <NoticeTakedownModal onClose={() => setShowNoticeTakedown(false)} />}
      {showAnonymity && <AnonymityPolicyModal onClose={() => setShowAnonymity(false)} />}
    </footer>
  );
}
