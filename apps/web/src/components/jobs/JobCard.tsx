"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { isOwnStaticAsset } from "@/lib/imageSource";
import {
  type CompanyListItem,
  type CompanyVibeFlags,
  type VibeFlag,
  type WorkplaceType,
  primaryWorkplaceType,
} from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { scoreTextColor } from "@/lib/scoreBandColors";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { canUseBanner } from "@/lib/pricingTiers";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";
import { RiskScoreBadge } from "@/components/jobs/RiskScoreBadge";
import { BookmarkIcon } from "@/components/jobs/BookmarkIcon";
import { ApplyButton } from "@/components/jobs/ApplyButton";
import { useSavedJobPostings } from "@/lib/useSavedJobPostings";

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
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-green-700 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
// Icon-only (the label is spoken, and shown as a tooltip) so Mail, Call and
// Apply fit on one line next to the job title.
export function ContactButton({ icon, label, value }: { icon: "mail" | "phone"; label: string; value: string | null }) {
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
        title={label}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-surface-muted"
      >
        <Icon className="h-3.5 w-3.5" />
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
export type CardPosting =
  | { id?: string; jobTitle: string; description: string | null; workType: WorkplaceType | null }
  | null;

export function postingsForCard(company: CompanyListItem): CardPosting[] {
  if (company.jobPostings.length > 0) {
    return company.jobPostings.map((p) => ({
      id: p.id,
      jobTitle: p.jobTitle,
      description: p.description,
      workType: p.workType,
    }));
  }
  if (company.jobTitles.length > 0) {
    // Auto-classified titles have no owner-authored description to show, and
    // no real posting id — never bookmarkable (see the bookmark button's own
    // posting?.id guard below). workType comes from the same classifyJobRole
    // call the server already ran to decide whether to surface this title at
    // all (see CompaniesService.jobTitlesByCompanyId) — never re-derived
    // client-side.
    return company.jobTitles.map((t) => ({ jobTitle: t.title, description: null, workType: t.workType }));
  }
  return [null];
}

// How big the card is drawn:
// - "full": square content box with the whole description (a company's own
//   Jobs tab, where people read each role in full).
// - "compact": the /jobs grid. A short card (one-line name, four lines of
//   description); clicking the description opens "expanded".
// - "expanded": the wider floating copy of a compact card, full description,
//   with a close button on the banner.
export type JobCardVariant = "full" | "compact" | "expanded";

// The floating panel is at least this wide (or the screen, minus a margin).
const EXPANDED_MIN_WIDTH = 520;

// One job card: 4:1 banner strip, then the content box (logo+name header,
// address/sector, one job title + contact, rating + vibe-flags "i" menu),
// then a work-type footer strip below the box.
export function JobCard({
  company,
  posting,
  expired = false,
  variant = "full",
  onClose,
}: {
  company: CompanyListItem;
  posting: CardPosting;
  // True only inside the Saved Posts view, for a posting that's expired or
  // been marked filled. Defaults false everywhere else this card renders
  // (the public browse grid and the company profile tab are unaffected).
  expired?: boolean;
  variant?: JobCardVariant;
  // "expanded" only: closes the floating panel.
  onClose?: () => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [expandedAt, setExpandedAt] = useState<{ top: number; left: number; width: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const compact = variant === "compact";
  const expandedView = variant === "expanded";

  // Lays the floating panel over this card: same top-left corner, wider,
  // kept inside the window. Page coordinates, so it scrolls with the page.
  const placeExpanded = useCallback(() => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(Math.max(rect.width, EXPANDED_MIN_WIDTH), window.innerWidth - 32);
    const left = Math.min(Math.max(rect.left, 16), window.innerWidth - width - 16) + window.scrollX;
    setExpandedAt({ top: rect.top + window.scrollY, left, width });
  }, []);

  const closeExpanded = useCallback(() => {
    setExpandedAt(null);
    moreRef.current?.focus();
  }, []);
  const { savedIds, canSave, toggleSave, loading: savedLoading } = useSavedJobPostings();
  const location = [company.district, company.city].filter(Boolean).join(", ");
  // Every job card shows a banner: the owner's own image when their tier
  // includes custom banners and one is set, otherwise the system default.
  // A default banner on an unclaimed company renders greyscale.
  const hasCustomBanner = canUseBanner(company.badgeTier) && !!company.bannerImageUrl;
  const bannerUrl = hasCustomBanner ? company.bannerImageUrl! : company.defaultBannerUrl;
  const bannerIsGreyscale = !hasCustomBanner && !company.hasApprovedOwner;
  const isSaved = posting?.id ? savedIds.has(posting.id) : false;
  // One work-type per card, not the company's whole (up to 2) list — the
  // posting's own workType when there is one (real postings always have one
  // now; the auto-classified fallback carries its classifyJobRole result),
  // falling back to the company's primary type only for pre-existing
  // postings created before this field existed.
  const cardWorkType = posting?.workType ?? primaryWorkplaceType(company);

  return (
    // No overflow-hidden here (unlike a typical image-topped card) — the "i"
    // button's flag dropdown and the contact popovers are absolutely
    // positioned to spill outside this box, and clipping it would make them
    // invisible. expired greys the whole card, except the bookmark button
    // below stays live — a Saved Posts card for a filled/expired posting
    // must still be un-savable. The native `inert` attribute (not just
    // pointer-events-none, which only blocks clicks/taps, not Tab focus or
    // Enter/Space activation on a nested Link/button) is applied to a nested
    // wrapper around just the navigable/interactive content, not this outer
    // div, since `inert` can't be selectively un-set on a descendant once an
    // ancestor has it.
    <div
      ref={cardRef}
      className={`flex flex-col rounded-xl border border-border bg-surface transition hover:border-brand-300 dark:hover:border-brand-700 ${expired ? "opacity-50" : ""} ${expandedView ? "shadow-2xl" : ""}`}
    >
      {/* Banner sits above the square content box (not inside it, so it
          doesn't eat that box's fixed proportions). Facebook-style overlap —
          logo over the banner's bottom-left corner. The banner sits flush at
          the card's own top edge, so the content box below gets pt-5 to
          clear the protruding logo. No ring around the logo: a transparent
          brand image should read as transparent, not sit in a coloured box. */}
      <div className="relative">
        <div className="relative aspect-[4/1] w-full overflow-hidden rounded-t-xl">
          <Image
            src={bannerUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 320px, (min-width: 640px) 50vw, 100vw"
            unoptimized={!isOwnStaticAsset(bannerUrl)}
            className={`h-full w-full object-cover ${bannerIsGreyscale ? "grayscale" : ""}`}
          />
        </div>
        <div className="absolute left-3 top-full -translate-y-1/2">
          <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="sm" />
        </div>
        {expandedView && onClose && (
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Close the full job posting"
            title="Close"
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface/90 text-foreground shadow-sm transition hover:bg-surface"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
      <div
        className={`relative flex flex-col rounded-b-xl p-4 pt-5 ${
          compact ? "flex-1" : expandedView ? "" : "aspect-square compact:p-3"
        }`}
      >
        <div
          inert={expired}
          aria-disabled={expired}
          className={`flex flex-1 flex-col ${expired ? "pointer-events-none" : ""}`}
        >
          {/* Top row: name (top-left) ... rating + info button (top-right). The
              logo already sits above, overlapping the banner, so this row is
              name-only. */}
          <div className="flex items-start justify-between gap-2">
            <Link href={`/companies/${company.slug}`} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                title={compact ? company.name : undefined}
                className={`${compact ? "line-clamp-1" : "line-clamp-2"} min-w-0 font-display text-lg leading-snug text-foreground`}
              >
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
                className={`font-grotesk text-sm font-bold tabular-nums ${company.overallAvg !== null ? scoreTextColor(company.overallAvg) : "text-muted-foreground"}`}
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

          {/* This card's one job title + Mail/Call/Apply on a single line.
              Mail and Call are icon-only so all three fit; the title chip
              is capped at its column's width and truncates (full title in
              its tooltip) rather than sliding under the buttons. No
              overflow-hidden here — the Contact popovers spill outside. */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {posting ? (
                <span
                  title={posting.jobTitle}
                  className="inline-block max-w-full truncate rounded-full bg-brand-50 px-2 py-1 align-middle text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                >
                  {posting.jobTitle}
                </span>
              ) : (
                <span className="text-xs font-bold text-muted-foreground">No open roles listed yet</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <ContactButton icon="mail" label="Mail" value={company.contactEmail} />
              <ContactButton icon="phone" label="Call" value={company.contactPhone} />
              {posting?.id && <ApplyButton jobPostingId={posting.id} />}
            </div>
          </div>

          {/* The description the owner wrote for this posting — shown by
              default, filling the rest of the box, not tucked behind a click.
              Only individually-authored postings carry one; the auto-classified
              jobTitles fallback has none to show. */}
          {compact ? (
            // Always four lines tall, so every card in the grid is the same
            // size. Clicking the text opens the whole posting over the card.
            posting?.description ? (
              <button
                ref={moreRef}
                type="button"
                onClick={() => (expandedAt ? closeExpanded() : placeExpanded())}
                aria-expanded={expandedAt !== null}
                title="Click to read the full job posting"
                className="mt-3 h-20 cursor-pointer rounded text-left text-sm text-muted-foreground transition hover:text-foreground"
              >
                <span className="line-clamp-4 whitespace-pre-wrap">{posting.description}</span>
                <span className="sr-only"> (open the full job posting)</span>
              </button>
            ) : (
              <div className="mt-3 h-20" />
            )
          ) : (
            posting?.description && (
              <p
                className={`mt-3 whitespace-pre-wrap text-muted-foreground ${
                  expandedView ? "max-h-[55vh] overflow-y-auto text-sm" : "flex-1 overflow-y-auto text-xs"
                }`}
              >
                {posting.description}
              </p>
            )
          )}
        </div>
      </div>

      {/* Card footer, below the main content box. Work-type text on the
          left; the save button and the Risk Score right-aligned in the same
          row (not stacked) — "-" whenever this card has no real, appliable
          posting behind it (the auto-classified fallback and the "no open
          roles" empty state both count as no real posting; see
          RiskScoreBadge). */}
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 compact:px-2 compact:py-1.5">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          <span className="font-bold">{workplaceTypeLabel(cardWorkType)}</span>
          {company.isChainStore ? " · Chain store" : ""}
          {" · "}
          {company.reviewCount} review{company.reviewCount === 1 ? "" : "s"}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Only a real, individually-authored posting can be saved — the
              auto-classified jobTitles fallback has no posting.id. Always
              rendered, disabled + tooltip for a logged-out/non-worker viewer,
              same convention as the vote buttons in ReviewsList.tsx (never
              hides the affordance outright). The footer sits outside the
              inert wrapper, so it stays clickable on an expired Saved Posts
              card. -my-1 keeps the footer's height. */}
          {posting?.id && (
            <button
              type="button"
              onClick={() => canSave && toggleSave(posting.id!)}
              disabled={!canSave || savedLoading}
              title={!canSave ? "Log in to save" : undefined}
              aria-label={isSaved ? "Remove from saved posts" : "Save this posting"}
              aria-pressed={isSaved}
              className="-my-1 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-40"
            >
              <BookmarkIcon className="h-4 w-4" filled={isSaved} />
            </button>
          )}
          <RiskScoreBadge
            riskScore={company.riskScore > 0 ? company.riskScore : posting?.id ? 0 : null}
            short
          />
        </div>
      </div>

      {compact && expandedAt && (
        <ExpandedJobCard
          at={expandedAt}
          onReposition={placeExpanded}
          onClose={closeExpanded}
          triggerRef={moreRef}
          company={company}
          posting={posting}
          expired={expired}
        />
      )}
    </div>
  );
}

/**
 * The full-posting view: a wider copy of the card floating over the original, with
 * the whole description. Not a full-page dialog - the rest of the page stays
 * visible and usable; a click outside it or Esc closes it.
 */
function ExpandedJobCard({
  at,
  onReposition,
  onClose,
  triggerRef,
  company,
  posting,
  expired,
}: {
  at: { top: number; left: number; width: number };
  onReposition: () => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  company: CompanyListItem;
  posting: CardPosting;
  expired: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
    };
  }, [onClose, onReposition, triggerRef]);

  return createPortal(
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-label={posting ? `${posting.jobTitle} at ${company.name}` : company.name}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: "absolute", top: at.top, left: at.left, width: at.width, transformOrigin: "top left" }}
      // Under the sticky header (z-40) and the message dock, over the grid.
      className="z-30"
    >
      <JobCard company={company} posting={posting} expired={expired} variant="expanded" onClose={onClose} />
    </motion.div>,
    document.body,
  );
}
