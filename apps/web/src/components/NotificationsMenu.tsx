"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Notification as ApiNotification } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Notification model
//
// apps/api's GET /me/notifications (NotificationsService.list) only derives
// 4 of the 12 kinds below — VOTE_HELPFUL, VOTE_NOT_HELPFUL, COMPANY_REPLY,
// JOB_POSTING_PUBLISHED — from real ReviewVote/CompanyReply/JobPosting rows.
// The other 8 (review moderation outcomes, account verification, IWT
// Social, and 2 of the 3 employer kinds) have no backend event source yet.
// Per this task's brief ("do not touch backend/DB"), this file is frontend
// UI only: it fetches the 4 real kinds and merges in a small labeled sample
// set (SAMPLE_NOTIFICATIONS below) so every kind's copy/icon/category/link
// logic is complete and visible today. Swapping to a fully real feed later
// is a one-line change — delete the SAMPLE_NOTIFICATIONS merge once the
// backend grows the other event sources; everything else (describe/href/
// icon/category, unread state, the employer filter) is already correct for
// whatever NotificationsService.list eventually returns.
// ---------------------------------------------------------------------------

type NotificationCategory = "SOCIAL" | "SYSTEM" | "EMPLOYER";

type NotificationKind =
  // Employee social
  | "VOTE_HELPFUL"
  | "VOTE_NOT_HELPFUL"
  | "COMPANY_REPLY"
  | "SAME_COMPANY_REVIEWED"
  // Employee system
  | "REVIEW_PUBLISHED"
  | "REVIEW_NOT_PUBLISHED"
  | "VERIFY_ACCOUNT"
  | "REVIEW_REMOVED"
  | "IWT_SOCIAL_UPDATE"
  // Employer only
  | "JOB_POSTING_PUBLISHED"
  | "COMPANY_REVIEWED"
  | "JOB_POSTING_NEEDS_INFO";

const CATEGORY_BY_KIND: Record<NotificationKind, NotificationCategory> = {
  VOTE_HELPFUL: "SOCIAL",
  VOTE_NOT_HELPFUL: "SOCIAL",
  COMPANY_REPLY: "SOCIAL",
  SAME_COMPANY_REVIEWED: "SOCIAL",
  REVIEW_PUBLISHED: "SYSTEM",
  REVIEW_NOT_PUBLISHED: "SYSTEM",
  VERIFY_ACCOUNT: "SYSTEM",
  REVIEW_REMOVED: "SYSTEM",
  IWT_SOCIAL_UPDATE: "SYSTEM",
  JOB_POSTING_PUBLISHED: "EMPLOYER",
  COMPANY_REVIEWED: "EMPLOYER",
  JOB_POSTING_NEEDS_INFO: "EMPLOYER",
};

interface AppNotification {
  id: string;
  kind: NotificationKind;
  createdAt: string; // ISO
  unread: boolean;
  // Anonymous-by-design platform (see CLAUDE.md) — voters/reviewers are
  // never named, so actorName is always absent in real data and copy falls
  // back to "Someone". Kept as a field (not hardcoded) so a future named
  // source — e.g. an employer's own display name — can still fill it in.
  actorName?: string;
  companyName?: string;
  companySlug?: string | null;
}

function describeNotification(n: AppNotification): string {
  const actor = n.actorName ?? "Someone";
  const company = n.companyName ?? "the company";
  switch (n.kind) {
    case "VOTE_HELPFUL":
      return `${actor} found your review 'Helpful'.`;
    case "VOTE_NOT_HELPFUL":
      return `${actor} found your review 'Not Helpful'.`;
    case "COMPANY_REPLY":
      return `${company} replied to your review.`;
    case "SAME_COMPANY_REVIEWED":
      return "Someone reviewed the same company as you. Find out here!";
    case "REVIEW_PUBLISHED":
      return "Your review is published!";
    case "REVIEW_NOT_PUBLISHED":
      return "Your review is not published, read the details here.";
    case "VERIFY_ACCOUNT":
      return "Verify your number and mail address to get started.";
    case "REVIEW_REMOVED":
      return "Your review is removed.";
    case "IWT_SOCIAL_UPDATE":
      return "Check out new updates on 'IWT Social'!";
    case "JOB_POSTING_PUBLISHED":
      return "Your job posting is up!";
    case "COMPANY_REVIEWED":
      return "Someone reviewed your company. Find out here!";
    case "JOB_POSTING_NEEDS_INFO":
      return "Your job posting has missing/incorrect information.";
  }
}

function hrefForNotification(n: AppNotification): string {
  switch (n.kind) {
    case "VOTE_HELPFUL":
    case "VOTE_NOT_HELPFUL":
    case "COMPANY_REPLY":
    case "SAME_COMPANY_REVIEWED":
    case "REVIEW_PUBLISHED":
    case "REVIEW_NOT_PUBLISHED":
    case "REVIEW_REMOVED":
      return n.companySlug ? `/companies/${n.companySlug}` : "/me/reviews";
    case "VERIFY_ACCOUNT":
      return "/me";
    case "IWT_SOCIAL_UPDATE":
      return "/social";
    case "JOB_POSTING_PUBLISHED":
    case "JOB_POSTING_NEEDS_INFO":
      return "/jobs";
    case "COMPANY_REVIEWED":
      return n.companySlug ? `/companies/${n.companySlug}` : "/my/companies";
  }
}

function timeAgo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  const diffWeek = Math.floor(diffDay / 7);
  return `${diffWeek} week${diffWeek === 1 ? "" : "s"} ago`;
}

function agoIso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

// Sample data standing in for the 8 kinds NotificationsService.list doesn't
// emit yet (see the file-header comment). "i-worked-there" is a real seeded
// company slug so these links resolve to a real page rather than a 404.
const SAMPLE_NOTIFICATIONS: AppNotification[] = [
  {
    id: "sample-same-company",
    kind: "SAME_COMPANY_REVIEWED",
    createdAt: agoIso(40),
    unread: true,
    companySlug: "i-worked-there",
  },
  {
    id: "sample-review-published",
    kind: "REVIEW_PUBLISHED",
    createdAt: agoIso(70),
    unread: true,
    companySlug: "i-worked-there",
  },
  {
    id: "sample-review-not-published",
    kind: "REVIEW_NOT_PUBLISHED",
    createdAt: agoIso(130),
    unread: true,
    companySlug: "i-worked-there",
  },
  {
    id: "sample-verify-account",
    kind: "VERIFY_ACCOUNT",
    createdAt: agoIso(5),
    unread: true,
  },
  {
    id: "sample-review-removed",
    kind: "REVIEW_REMOVED",
    createdAt: agoIso(1600),
    unread: false,
    companySlug: "i-worked-there",
  },
  {
    id: "sample-iwt-social",
    kind: "IWT_SOCIAL_UPDATE",
    createdAt: agoIso(2900),
    unread: false,
  },
  {
    id: "sample-company-reviewed",
    kind: "COMPANY_REVIEWED",
    createdAt: agoIso(200),
    unread: true,
    companySlug: "i-worked-there",
  },
  {
    id: "sample-job-posting-needs-info",
    kind: "JOB_POSTING_NEEDS_INFO",
    createdAt: agoIso(300),
    unread: true,
    companyName: "your company",
  },
];

function toAppNotification(n: ApiNotification): AppNotification {
  return {
    id: n.id,
    kind: n.type,
    createdAt: n.createdAt,
    unread: true,
    companyName: n.companyName,
    companySlug: n.companySlug,
  };
}

function byNewestFirst(a: AppNotification, b: AppNotification): number {
  return a.createdAt < b.createdAt ? 1 : -1;
}

// --- Icons ------------------------------------------------------------

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
// Social: a heart (as suggested in the brief) covers votes/replies/"same
// company" alike — one consistent glyph per category reads faster at a
// glance than a different icon per kind.
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 21s-7.5-4.6-10-9.2C.5 8.3 2.3 5 5.6 5c1.8 0 3.3.9 4.4 2.4C11.1 5.9 12.6 5 14.4 5c3.3 0 5.1 3.3 3.6 6.8C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}
// System: a shield — account/review/platform status events.
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M12 8v5" />
      <circle cx="12" cy="16.2" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
// Employer: a briefcase — job-posting and "your company" events, same
// silhouette the "Hire now!" nav link already uses elsewhere in the header.
function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <path d="M2 13h20" />
    </svg>
  );
}

const CATEGORY_ICON: Record<NotificationCategory, (props: { className?: string }) => React.JSX.Element> = {
  SOCIAL: HeartIcon,
  SYSTEM: ShieldIcon,
  EMPLOYER: BriefcaseIcon,
};
// Distinct, high-contrast rings that hold up in both themes — solid hues,
// no washed-out tints that would fail the "equal parity" requirement.
const CATEGORY_RING_CLASS: Record<NotificationCategory, string> = {
  SOCIAL: "border-rose-500 text-rose-600 dark:text-rose-400",
  SYSTEM: "border-sky-500 text-sky-600 dark:text-sky-400",
  EMPLOYER: "border-amber-500 text-amber-600 dark:text-amber-400",
};

// One row. The whole block is the link (per the brief) — icon, copy, and
// timestamp all route together. Sized generously (large tap target, plain
// large text, no secondary micro-actions crowding the row) for a one-glance,
// one-tap read on a phone with tired hands, not a dense desktop table.
function NotificationRow({ n, onOpen }: { n: AppNotification; onOpen: (id: string) => void }) {
  const category = CATEGORY_BY_KIND[n.kind];
  const Icon = CATEGORY_ICON[category];
  const isVerifyAccount = n.kind === "VERIFY_ACCOUNT";

  return (
    <li>
      <Link
        href={hrefForNotification(n)}
        onClick={() => onOpen(n.id)}
        className={`flex items-start gap-3 rounded-xl px-3 py-3 transition ${
          isVerifyAccount
            ? "border-2 border-brand-600 bg-brand-50 hover:bg-brand-100 dark:border-brand-400 dark:bg-brand-950 dark:hover:bg-brand-900"
            : `hover:bg-surface-muted ${n.unread ? "bg-surface-muted/60" : ""}`
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-surface ${CATEGORY_RING_CLASS[category]}`}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            {/* Unread dot — the brief's explicit "colored dot" indicator. */}
            {n.unread && (
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-label="Unread" title="Unread" />
            )}
            <span className={`text-sm leading-snug text-foreground ${n.unread ? "font-bold" : "font-medium"}`}>
              {describeNotification(n)}
              {isVerifyAccount && (
                <span className="ml-2 inline-block rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                  Verify now
                </span>
              )}
            </span>
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Header bell — fetches GET /me/notifications on first open (not eagerly on
 * mount, since most page loads never open it), merges in SAMPLE_NOTIFICATIONS
 * for the kinds the backend doesn't emit yet (see file-header comment), and
 * caches the merged result for the rest of this mount. Unread state is local
 * only — every notification starts unread each time this mounts, since
 * neither the real feed nor the sample data carries a persisted read flag;
 * "Mark all as read" clears it for the current session.
 */
export function NotificationsMenu() {
  const { role } = useAuth();
  const isEmployer = role === "COMPANY_OWNER";
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || notifications !== null) return;
    apiGet<ApiNotification[]>("/me/notifications")
      .then((real) => {
        setNotifications([...real.map(toAppNotification), ...SAMPLE_NOTIFICATIONS].sort(byNewestFirst));
      })
      .catch(() => {
        setNotifications([...SAMPLE_NOTIFICATIONS].sort(byNewestFirst));
      });
  }, [open, notifications]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Employer-only kinds never show for a non-employer account, regardless
  // of source (real or sample).
  const visible = useMemo(
    () => notifications?.filter((n) => isEmployer || CATEGORY_BY_KIND[n.kind] !== "EMPLOYER") ?? null,
    [notifications, isEmployer],
  );
  const unreadCount = visible?.filter((n) => n.unread).length ?? 0;

  function markAllRead() {
    setNotifications((prev) => prev?.map((n) => ({ ...n, unread: false })) ?? prev);
  }

  function markOneRead(id: string) {
    setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, unread: false } : n)) ?? prev);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative font-sans">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        title="Notifications"
        className="relative flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
      >
        <span className="relative flex h-8 w-8 items-center justify-center">
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-surface"
              aria-hidden="true"
            />
          )}
        </span>
        <span className="text-[11px] font-medium leading-none">Notifications</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 max-w-[92vw] rounded-2xl border border-border bg-surface p-3 shadow-xl">
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <h2 className="text-base font-bold text-foreground">Notifications</h2>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="rounded-lg border-2 border-border px-3 py-2 text-sm font-bold text-foreground transition hover:border-brand-600 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground dark:hover:border-brand-400 dark:hover:text-brand-400"
            >
              Mark all as read
            </button>
          </div>

          {visible === null ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <BellIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">You have no new notifications.</p>
            </div>
          ) : (
            <ul className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto">
              {visible.map((n) => (
                <NotificationRow key={n.id} n={n} onOpen={markOneRead} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
