"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { type CompanyListItem, type CompanyVibeFlags, type VibeFlag } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { scoreTextColor } from "@/lib/scoreBandColors";
import { WorkTypeLabel } from "@/components/WorkTypeLabel";
import { canUseBanner } from "@/lib/pricingTiers";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";

// The standard job card, shared by the /jobs browse grid (JobsBrowser) and
// a company's own "Job Postings" profile tab (CompanyJobPostings). One card
// = one open role, so a multi-role employer renders one card per posting
// (see postingsForCard).

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyIconButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy to clipboard"
      aria-label="Copy to clipboard"
      onClick={async () => {
        if (await copyToClipboard(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
    >
      {copied ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 4h3.5l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3.5a1.5 1.5 0 0 1-1.6 1.5A17 17 0 0 1 3 5.6 1.5 1.5 0 0 1 4.5 4Z" />
    </svg>
  );
}

// "Mail" / "Call" — icon + short word, side by side. Click opens a small
// popover with the raw value + a copy-to-clipboard icon, rather than a
// mailto:/tel: link (a reviewer-anonymous platform never wants an accidental
// full mail-client handoff to be the only option — copying is the more
// reliable action on both desktop and mobile).
function ContactButton({ icon, label, value }: { icon: "mail" | "phone"; label: string; value: string | null }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Closes this popover on any click/tap outside it. Mail and Call each
  // manage their own `open` state independently, so both stay open if the
  // user opens both — this only reacts to a click landing outside the
  // ref'd container.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  if (!value) return null;
  const Icon = icon === "mail" ? MailIcon : PhoneIcon;
  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${label}: ${value}`}
        className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-muted"
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground shadow-lg">
          <span>{value}</span>
          <CopyIconButton text={value} />
        </div>
      )}
    </div>
  );
}

const VIBE_FLAG_ROW_ORDER = ["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"];

// Compact popover version of WorkplaceVibeFlags.tsx (that component is a
// fixed lg:h-[672px] page-section box, far too large for a card's dropdown
// menu) — pools every work-type's flags into one flat green/red list,
// deduped by category+cluster, capped so the popover stays small.
function VibeFlagsPopover({ companySlug }: { companySlug: string }) {
  const [data, setData] = useState<CompanyVibeFlags | null | "error">(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<CompanyVibeFlags>(`/companies/${companySlug}/vibe-flags`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData("error");
      });
    return () => {
      cancelled = true;
    };
  }, [companySlug]);

  if (data === null) return <p className="p-1 text-xs text-muted-foreground">Loading...</p>;
  if (data === "error") return <p className="p-1 text-xs text-muted-foreground">Couldn&apos;t load flags.</p>;

  const allFlags = data.byWorkplaceType.flatMap((s) => s.flags);
  const seen = new Set<string>();
  const pooled: VibeFlag[] = [];
  for (const category of VIBE_FLAG_ROW_ORDER) {
    for (const flag of allFlags.filter((f) => f.category === category)) {
      const key = `${flag.category}-${flag.cluster}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pooled.push(flag);
    }
  }
  if (pooled.length === 0) {
    return <p className="p-1 text-xs text-muted-foreground">No flags yet.</p>;
  }

  return (
    <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
      {pooled.map((f) => (
        <li key={`${f.category}-${f.cluster}`} className="flex items-center gap-1.5 text-xs">
          <span aria-hidden="true">{f.color === "GREEN" ? "✅" : "🚩"}</span>
          <span className="truncate text-foreground">{f.label}</span>
        </li>
      ))}
    </ul>
  );
}

// One card = one job (or the company's empty state). JobPosting carries its
// own boost fields per row in the DB, so splitting the card this way lines
// the UI up with what the data model already supports: pick "3D Artist",
// not "3D Artist AND Forklift Operatörü", when buying a boost.
export type CardPosting = { jobTitle: string; description: string | null } | null;

export function postingsForCard(company: CompanyListItem): CardPosting[] {
  if (company.jobPostings.length > 0) {
    return company.jobPostings.map((p) => ({ jobTitle: p.jobTitle, description: p.description }));
  }
  if (company.jobTitles.length > 0) {
    // Auto-classified titles have no owner-authored description to show.
    return company.jobTitles.map((title) => ({ jobTitle: title, description: null }));
  }
  return [null];
}

// One job card: 4:1 banner strip, then a square content box (logo+name
// header, address/sector, one job title + contact, rating + vibe-flags "i"
// menu), then a work-type footer strip below the box.
export function JobCard({ company, posting }: { company: CompanyListItem; posting: CardPosting }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const location = [company.district, company.city].filter(Boolean).join(", ");
  // Every job card shows a banner: the owner's own image when their tier
  // includes custom banners and one is set, otherwise the system default.
  // A default banner on an unclaimed company renders greyscale.
  const hasCustomBanner = canUseBanner(company.badgeTier) && !!company.bannerImageUrl;
  const bannerUrl = hasCustomBanner ? company.bannerImageUrl! : company.defaultBannerUrl;
  const bannerIsGreyscale = !hasCustomBanner && !company.hasApprovedOwner;

  return (
    // No overflow-hidden here (unlike a typical image-topped card) — the "i"
    // button's flag dropdown and the contact popovers are absolutely
    // positioned to spill outside this box, and clipping it would make them
    // invisible.
    <div className="flex flex-col rounded-xl border border-border bg-surface transition hover:border-brand-300 dark:hover:border-brand-700">
      {/* Banner sits above the square content box (not inside it, so it
          doesn't eat that box's fixed proportions). Facebook-style overlap —
          logo over the banner's bottom-left corner. The banner sits flush at
          the card's own top edge, so the content box below gets pt-5 to
          clear the protruding logo. No ring around the logo: a transparent
          brand image should read as transparent, not sit in a coloured box. */}
      <div className="relative">
        <div className="aspect-[4/1] w-full overflow-hidden rounded-t-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed set of local /public default banners, or an owner-submitted URL */}
          <img
            src={bannerUrl}
            alt=""
            className={`h-full w-full object-cover ${bannerIsGreyscale ? "grayscale" : ""}`}
          />
        </div>
        <div className="absolute left-3 top-full -translate-y-1/2">
          <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="sm" />
        </div>
      </div>
      <div className="flex aspect-square flex-col rounded-b-xl p-4 pt-5 compact:p-3">
        {/* Top row: name (top-left) ... rating + info button (top-right). The
            logo already sits above, overlapping the banner, so this row is
            name-only. */}
        <div className="flex items-start justify-between gap-2">
          <Link href={`/companies/${company.slug}`} className="flex min-w-0 flex-1 items-center gap-2">
            <span className="line-clamp-2 min-w-0 font-semibold leading-snug text-foreground">
              {company.name}
              <CompanyVerificationTick
                badgeTier={company.badgeTier}
                claimed={company.hasApprovedOwner}
                size={14}
                className="ml-1.5"
              />
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* Colored by score band — red/orange/amber/lime/green at a
                glance, not just a number. */}
            <span
              className={`text-sm font-bold ${company.overallAvg !== null ? scoreTextColor(company.overallAvg) : "text-muted-foreground"}`}
              title="User rating"
            >
              {company.overallAvg !== null ? company.overallAvg.toFixed(1) : "—"}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setInfoOpen((v) => !v)}
                aria-label="Workplace flags"
                aria-expanded={infoOpen}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-[11px] font-bold leading-none text-muted-foreground transition hover:bg-surface-muted"
              >
                i
              </button>
              {infoOpen && (
                <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-lg border border-border bg-surface p-2 shadow-lg">
                  <VibeFlagsPopover companySlug={company.slug} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Address + sector, light weight */}
        <p className="mt-1.5 truncate text-xs font-light text-muted-foreground">
          {location || "Location not set"} · {company.category}
        </p>

        {/* This card's one job title + Mail/Call, side by side so the row
            stays short and leaves room for the description below. No
            overflow-hidden here — the Contact popovers spill outside. */}
        <div className="mt-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {posting ? (
              <span className="inline-block truncate rounded-full bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {posting.jobTitle}
              </span>
            ) : (
              <span className="text-xs font-bold text-muted-foreground">No open roles listed yet</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ContactButton icon="mail" label="Mail" value={company.contactEmail} />
            <ContactButton icon="phone" label="Call" value={company.contactPhone} />
          </div>
        </div>

        {/* The description the owner wrote for this posting — shown by
            default, filling the rest of the box, not tucked behind a click.
            Only individually-authored postings carry one; the auto-classified
            jobTitles fallback has none to show. */}
        {posting?.description && (
          <p className="mt-3 flex-1 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {posting.description}
          </p>
        )}
      </div>

      {/* Card footer, below the main content box */}
      <div className="border-t border-border px-3 py-2 compact:px-2 compact:py-1.5">
        <p className="truncate text-xs text-muted-foreground">
          <WorkTypeLabel workplaceTypes={company.workplaceTypes} />
          {company.isChainStore ? " · Chain store" : ""}
          {" · "}
          {company.reviewCount} review{company.reviewCount === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
