"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import type { Notification as ApiNotification } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api-client";
import { NOTIFICATIONS_STALE_EVENT } from "@/lib/notification-events";
import { useT } from "@/lib/i18n/client";
import type { TFn } from "@/lib/i18n/core";

// ---------------------------------------------------------------------------
// Notification model
//
// apps/api's GET /me/notifications (NotificationsService.list) derives 7 of
// the 15 kinds below from real rows — VOTE_HELPFUL, VOTE_NOT_HELPFUL,
// COMPANY_REPLY, JOB_POSTING_PUBLISHED (ReviewVote/CompanyReply/JobPosting),
// plus COMPANY_STATUS_UPDATE/COMPANY_NEW_SOCIAL_POST/COMPANY_HIRING (derived
// from the caller's CompanyFollow rows joined against
// CompanyAggregateScore/SocialPost/JobPosting — see notification.ts). The
// other 8 (review moderation outcomes, account verification, and 2 of the 3
// employer kinds) have no backend event source yet. This file fetches the
// real kinds and merges in a small labeled sample set (SAMPLE_NOTIFICATIONS
// below) so every kind's copy/icon/category/link logic is complete and
// visible today. (Update 2026-09-25: the sample set was removed. It showed
// real members made-up alerts such as "Your review is removed", and it was
// also what appeared whenever loading failed. Only real notifications are
// shown now; the other kinds render correctly once the API emits them.)
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
  // Followed-company events (IWT Social) - real, derived by
  // NotificationsService.list from CompanyFollow joined against
  // CompanyAggregateScore/SocialPost/JobPosting. See notification.ts's
  // file-header comment for the exact copy/link this implements.
  | "COMPANY_STATUS_UPDATE"
  | "COMPANY_NEW_SOCIAL_POST"
  | "COMPANY_HIRING"
  // Employer only
  | "JOB_POSTING_PUBLISHED"
  | "COMPANY_REVIEWED"
  | "JOB_POSTING_NEEDS_INFO"
  // Real, derived from READY BenchmarkReportJob rows; carries its own href
  // (the PDF download route).
  | "BENCHMARK_REPORT_READY"
  | "HR_REPORT_READY"
  // Real, derived from unread private review-conversation messages; carry
  // their own href (the right inbox).
  | "CONVERSATION_MESSAGE_FROM_COMPANY"
  | "CONVERSATION_MESSAGE_FROM_REVIEWER"
  // Real: company claim decisions, and (owners) new CV applications.
  | "CLAIM_APPROVED"
  | "CLAIM_REJECTED"
  | "JOB_APPLICATION_RECEIVED"
  // Real: IWT Social Questions (an answer to your question; a question put
  // to your company). Both carry their own href: the question's page for the
  // asker, the dashboard's Questions section for the owner.
  | "QUESTION_ANSWERED"
  | "COMPANY_QUESTION_ASKED"
  // Real: a scheduled IWT Social post that could not go out.
  | "SCHEDULED_POST_FAILED"
  // Real: a company the member reviewed has clearly risen since; carries
  // its own href (their review on the company page).
  | "RATED_COMPANY_IMPROVING";

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
  COMPANY_STATUS_UPDATE: "SOCIAL",
  COMPANY_NEW_SOCIAL_POST: "SOCIAL",
  COMPANY_HIRING: "SOCIAL",
  JOB_POSTING_PUBLISHED: "EMPLOYER",
  COMPANY_REVIEWED: "EMPLOYER",
  JOB_POSTING_NEEDS_INFO: "EMPLOYER",
  BENCHMARK_REPORT_READY: "EMPLOYER",
  HR_REPORT_READY: "EMPLOYER",
  CONVERSATION_MESSAGE_FROM_COMPANY: "SOCIAL",
  CONVERSATION_MESSAGE_FROM_REVIEWER: "EMPLOYER",
  CLAIM_APPROVED: "SYSTEM",
  CLAIM_REJECTED: "SYSTEM",
  JOB_APPLICATION_RECEIVED: "EMPLOYER",
  QUESTION_ANSWERED: "SOCIAL",
  COMPANY_QUESTION_ASKED: "EMPLOYER",
  SCHEDULED_POST_FAILED: "EMPLOYER",
  RATED_COMPANY_IMPROVING: "SOCIAL",
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
  // Set only when the API supplies an explicit destination.
  href?: string;
  jobTitle?: string;
}

function describeNotification(n: AppNotification, t: TFn): string {
  const actor = n.actorName ?? t("Someone");
  const company = n.companyName ?? t("the company");
  switch (n.kind) {
    case "VOTE_HELPFUL":
      return t("{actor} found your review 'Helpful'.", { actor });
    case "VOTE_NOT_HELPFUL":
      return t("{actor} found your review 'Not Helpful'.", { actor });
    case "COMPANY_REPLY":
      return t("{company} replied to your review.", { company });
    case "SAME_COMPANY_REVIEWED":
      return t("Someone reviewed the same company as you. Find out here!");
    case "REVIEW_PUBLISHED":
      return n.companyName ? t("Your review of {company} is published!", { company: n.companyName }) : t("Your review is published!");
    case "REVIEW_NOT_PUBLISHED":
      return n.companyName
        ? t("Your review of {company} wasn't published. Read the details here.", { company: n.companyName })
        : t("Your review is not published, read the details here.");
    case "VERIFY_ACCOUNT":
      return t("Verify your number and mail address to get started.");
    case "REVIEW_REMOVED":
      return t("Your review is removed.");
    case "IWT_SOCIAL_UPDATE":
      return t("Check out new updates on 'IWT Social'!");
    case "COMPANY_STATUS_UPDATE":
      return t("See how {company} is doing!", { company });
    case "COMPANY_NEW_SOCIAL_POST":
      return t("{company} just shared a new post!", { company });
    case "COMPANY_HIRING":
      return t("{company} is hiring now. Check it out!", { company });
    case "JOB_POSTING_PUBLISHED":
      return t("Your job posting is up!");
    case "COMPANY_REVIEWED":
      return n.companyName
        ? t("Someone reviewed {company}. Find out here!", { company: n.companyName })
        : t("Someone reviewed your company. Find out here!");
    case "JOB_POSTING_NEEDS_INFO":
      return t("Your job posting has missing/incorrect information.");
    case "BENCHMARK_REPORT_READY":
      return t("Your report is ready! Download the Sector Benchmark Report for {company}.", { company });
    case "HR_REPORT_READY":
      return t("Your report is ready! Download the HR Analytics Report for {company}.", { company });
    case "CONVERSATION_MESSAGE_FROM_COMPANY":
      return t("{company} sent you a message.", { company });
    case "CONVERSATION_MESSAGE_FROM_REVIEWER":
      return t("New message about a review of {company}.", { company });
    case "CLAIM_APPROVED":
      return t("Your claim for {company} was approved. Your company dashboard is ready!", { company });
    case "CLAIM_REJECTED":
      return t("Your claim for {company} wasn't approved.", { company });
    case "JOB_APPLICATION_RECEIVED":
      return n.jobTitle
        ? t("New application for {job} at {company}.", { job: n.jobTitle, company })
        : t("New application at {company}.", { company });
    case "QUESTION_ANSWERED":
      return n.companyName
        ? t("Your question to {company} has a new answer.", { company: n.companyName })
        : t("Your question has a new answer.");
    case "COMPANY_QUESTION_ASKED":
      return n.companyName
        ? t("Someone asked {company} a question. Answer it, then choose who sees it.", { company: n.companyName })
        : t("Someone asked your company a question.");
    case "SCHEDULED_POST_FAILED":
      return t("A scheduled post for {company} could not go out. See why, then pick a new time or delete it.", { company });
    case "RATED_COMPANY_IMPROVING":
      return t("{company}'s rating has gone up since you rated it. Want to update your rating?", { company });
  }
}

function hrefForNotification(n: AppNotification): string {
  switch (n.kind) {
    // Review-related kinds carry a link to the review itself, which its
    // page scrolls to and pulses (see ReviewsList / My Ratings).
    case "VOTE_HELPFUL":
    case "VOTE_NOT_HELPFUL":
    case "COMPANY_REPLY":
    case "REVIEW_PUBLISHED":
    case "REVIEW_NOT_PUBLISHED":
    case "COMPANY_REVIEWED":
    case "CLAIM_APPROVED":
    case "CLAIM_REJECTED":
    case "JOB_APPLICATION_RECEIVED":
      if (n.href) return n.href;
      break;
  }
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
    // Company status update -> the rating page (that company's profile).
    case "COMPANY_STATUS_UPDATE":
      return n.companySlug ? `/companies/${n.companySlug}` : "/social";
    // New post from a followed company -> that company's Social tab.
    case "COMPANY_NEW_SOCIAL_POST":
      return n.companySlug ? `/companies/${n.companySlug}?tab=social` : "/social";
    // Followed company is hiring -> that company's Job Postings tab.
    case "COMPANY_HIRING":
      return n.companySlug ? `/companies/${n.companySlug}?tab=jobs` : "/jobs";
    case "JOB_POSTING_PUBLISHED":
    case "JOB_POSTING_NEEDS_INFO":
      return "/jobs";
    case "COMPANY_REVIEWED":
      return n.companySlug ? `/companies/${n.companySlug}` : "/my/companies";
    case "CLAIM_APPROVED":
      return "/my/companies";
    case "CLAIM_REJECTED":
      return n.companySlug ? `/companies/${n.companySlug}` : "/";
    case "JOB_APPLICATION_RECEIVED":
      return "/my/companies";
    case "BENCHMARK_REPORT_READY":
    case "HR_REPORT_READY":
      return n.href ?? "/my/companies";
    case "CONVERSATION_MESSAGE_FROM_COMPANY":
      return n.href ?? "/social";
    case "CONVERSATION_MESSAGE_FROM_REVIEWER":
      return n.href ?? "/social";
    case "QUESTION_ANSWERED":
    case "COMPANY_QUESTION_ASKED":
      return n.href ?? "/social?tab=questions";
    case "SCHEDULED_POST_FAILED":
      return n.href ?? "/my/companies";
    case "RATED_COMPANY_IMPROVING":
      return n.href ?? (n.companySlug ? `/companies/${n.companySlug}` : "/me/reviews");
  }
}

// Social-post times come from the API rounded to the hour (see the API's
// toUtcHour), so they never read finer than "1 hour ago".
const HOUR_PRECISION_KINDS: ReadonlySet<NotificationKind> = new Set(["COMPANY_NEW_SOCIAL_POST", "QUESTION_ANSWERED", "COMPANY_QUESTION_ASKED"]);

function timeAgo(iso: string, t: TFn, hourPrecision = false): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  if (hourPrecision && diffMin < 60) return t("{n} hour ago", { n: 1 });
  if (diffSec < 60) return t("Just now");
  if (diffMin < 60) return t(diffMin === 1 ? "{n} minute ago" : "{n} minutes ago", { n: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t(diffHour === 1 ? "{n} hour ago" : "{n} hours ago", { n: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return t(diffDay === 1 ? "{n} day ago" : "{n} days ago", { n: diffDay });
  const diffWeek = Math.floor(diffDay / 7);
  return t(diffWeek === 1 ? "{n} week ago" : "{n} weeks ago", { n: diffWeek });
}


function toAppNotification(n: ApiNotification): AppNotification {
  return {
    id: n.id,
    kind: n.type,
    createdAt: n.createdAt,
    unread: !n.read,
    companyName: n.companyName,
    companySlug: n.companySlug,
    href: n.href,
    jobTitle: n.jobTitle,
  };
}

function byNewestFirst(a: AppNotification, b: AppNotification): number {
  return a.createdAt < b.createdAt ? 1 : -1;
}

// --- Icons ------------------------------------------------------------
// One line icon per kind of notification, all drawn the same way (24px
// grid, 1.75 stroke, round ends), each on a soft tile in a tone that says
// what kind of news it is: good (green), a problem (red), a message or
// report (blue), jobs and reviews (amber), questions and posts (teal),
// everything else (stone).

type IconProps = { className?: string };

function Glyph({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function BellIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M10.27 21a2 2 0 0 0 3.46 0" />
      <path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33" />
    </Glyph>
  );
}
const ThumbUpIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M7 10v12" />
    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
  </Glyph>
);
const ThumbDownIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M17 14V2" />
    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
  </Glyph>
);
const ReplyIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="m9 17-5-5 5-5" />
    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </Glyph>
);
const ChatIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </Glyph>
);
const StarIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M11.53 2.3a.53.53 0 0 1 .94 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.17.76a.53.53 0 0 1 .29.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.02a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .29-.9l5.17-.76a2.12 2.12 0 0 0 1.6-1.16Z" />
  </Glyph>
);
const CheckCircleIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </Glyph>
);
const XCircleIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6M9 9l6 6" />
  </Glyph>
);
const ShieldCheckIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </Glyph>
);
const SparkIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M9.94 14.06 4 12l5.94-2.06L12 4l2.06 5.94L20 12l-5.94 2.06L12 20Z" />
  </Glyph>
);
const TrendIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M16 7h6v6" />
    <path d="m22 7-8.5 8.5-5-5L2 17" />
  </Glyph>
);
const PostIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
  </Glyph>
);
const BriefcaseIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    <rect width="20" height="14" x="2" y="6" rx="2" />
  </Glyph>
);
const MegaphoneIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="m3 11 18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </Glyph>
);
const AlertIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4M12 17h.01" />
  </Glyph>
);
const ReportIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M12 18v-6M9 15l3 3 3-3" />
  </Glyph>
);
const BadgeCheckIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
    <path d="m9 12 2 2 4-4" />
  </Glyph>
);
const ApplicantIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6M22 11h-6" />
  </Glyph>
);
const QuestionIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
  </Glyph>
);
const ClockAlertIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M12 6v6l4 2" />
    <path d="M16 21.16a10 10 0 1 1 5-6.47" />
    <path d="M20 17v.01M20 13v1.5" />
  </Glyph>
);

type Tone = "good" | "bad" | "info" | "work" | "talk" | "plain";
const TONE_CLASS: Record<Tone, string> = {
  good: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  bad: "bg-rose-500/12 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
  info: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  work: "bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  talk: "bg-teal-500/12 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
  plain: "bg-surface-muted text-muted-foreground",
};

const KIND_LOOK: Record<NotificationKind, { Icon: (props: IconProps) => React.JSX.Element; tone: Tone }> = {
  VOTE_HELPFUL: { Icon: ThumbUpIcon, tone: "good" },
  VOTE_NOT_HELPFUL: { Icon: ThumbDownIcon, tone: "bad" },
  COMPANY_REPLY: { Icon: ReplyIcon, tone: "info" },
  SAME_COMPANY_REVIEWED: { Icon: StarIcon, tone: "work" },
  REVIEW_PUBLISHED: { Icon: CheckCircleIcon, tone: "good" },
  REVIEW_NOT_PUBLISHED: { Icon: XCircleIcon, tone: "bad" },
  VERIFY_ACCOUNT: { Icon: ShieldCheckIcon, tone: "work" },
  REVIEW_REMOVED: { Icon: XCircleIcon, tone: "bad" },
  IWT_SOCIAL_UPDATE: { Icon: SparkIcon, tone: "talk" },
  COMPANY_STATUS_UPDATE: { Icon: TrendIcon, tone: "plain" },
  COMPANY_NEW_SOCIAL_POST: { Icon: PostIcon, tone: "talk" },
  COMPANY_HIRING: { Icon: BriefcaseIcon, tone: "work" },
  JOB_POSTING_PUBLISHED: { Icon: MegaphoneIcon, tone: "good" },
  COMPANY_REVIEWED: { Icon: StarIcon, tone: "work" },
  JOB_POSTING_NEEDS_INFO: { Icon: AlertIcon, tone: "work" },
  BENCHMARK_REPORT_READY: { Icon: ReportIcon, tone: "info" },
  HR_REPORT_READY: { Icon: ReportIcon, tone: "info" },
  CONVERSATION_MESSAGE_FROM_COMPANY: { Icon: ChatIcon, tone: "info" },
  CONVERSATION_MESSAGE_FROM_REVIEWER: { Icon: ChatIcon, tone: "info" },
  CLAIM_APPROVED: { Icon: BadgeCheckIcon, tone: "good" },
  CLAIM_REJECTED: { Icon: XCircleIcon, tone: "bad" },
  JOB_APPLICATION_RECEIVED: { Icon: ApplicantIcon, tone: "talk" },
  QUESTION_ANSWERED: { Icon: QuestionIcon, tone: "talk" },
  COMPANY_QUESTION_ASKED: { Icon: QuestionIcon, tone: "talk" },
  SCHEDULED_POST_FAILED: { Icon: ClockAlertIcon, tone: "bad" },
  RATED_COMPANY_IMPROVING: { Icon: TrendIcon, tone: "good" },
};

// One row: the whole row is the link. Icon tile, the message (two lines at
// most) with the time on the right, and a Wood dot while it is new.
function NotificationRow({ n, onOpen }: { n: AppNotification; onOpen: (id: string) => void }) {
  const t = useT();
  const { Icon, tone } = KIND_LOOK[n.kind];
  const isVerifyAccount = n.kind === "VERIFY_ACCOUNT";
  const href = hrefForNotification(n);
  // API routes (the benchmark PDF download) are real file responses, not
  // app pages — a client-side <Link> would try to route to them.
  const isFile = href.startsWith("/api/");
  const RowLink = isFile ? "a" : Link;

  return (
    <li>
      <RowLink
        href={href}
        {...(isFile ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        onClick={() => onOpen(n.id)}
        className="group flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-surface-muted"
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONE_CLASS[tone]}`} aria-hidden="true">
          <Icon className="h-[18px] w-[18px]" />
        </span>

        <span className="min-w-0 flex-1 pt-0.5">
          <span className="flex items-baseline gap-3">
            <span
              className={`line-clamp-2 min-w-0 flex-1 text-[13.5px] leading-snug ${
                n.unread ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {describeNotification(n, t)}
            </span>
            <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
              {timeAgo(n.createdAt, t, HOUR_PRECISION_KINDS.has(n.kind))}
            </span>
          </span>
          {isVerifyAccount && (
            <span className="mt-1.5 inline-block text-xs font-semibold text-brand-600 group-hover:underline dark:text-brand-400">
              {t("Verify now")}
            </span>
          )}
        </span>

        <span className="flex h-9 w-2 shrink-0 items-center justify-center">
          {n.unread && <span className="h-2 w-2 rounded-full bg-brand-600" aria-label={t("Unread")} title={t("Unread")} />}
        </span>
      </RowLink>
    </li>
  );
}

// "Today" first, then everything older under "Earlier" - two quiet groups
// instead of one long run.
function splitByDay(list: AppNotification[]): { label: string; items: AppNotification[] }[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = list.filter((n) => new Date(n.createdAt) >= startOfToday);
  const earlier = list.filter((n) => new Date(n.createdAt) < startOfToday);
  return [
    { label: "Today", items: today },
    { label: "Earlier", items: earlier },
  ].filter((g) => g.items.length > 0);
}

// Saved on the account. If saving fails the next load simply shows them
// unread again.
function saveRead(ids: string[]) {
  if (ids.length === 0) return;
  void apiPost("/me/notifications/read", { ids }).catch(() => undefined);
}

/**
 * Header bell: a symbol with no label, with a red counter on its top-right
 * corner while there is something new (like an app icon on a phone). Loads
 * GET /me/notifications as soon as it mounts (so the counter shows without
 * opening it), again every time it's opened, and whenever something on the
 * page announces a new one (lib/notification-events.ts).
 *
 * Opening the panel counts as seeing what's in it: everything new is saved
 * as read on the account straight away (POST /me/notifications/read), which
 * is what makes the counter go away and stay away after signing in again or
 * on another device. The rows that were new stay highlighted until the
 * panel is closed, so it's still clear which ones they were.
 * The bell only renders for a signed-in, active account (GlobalHeader), so
 * nothing is ever loaded or kept for a visitor.
 */
export function NotificationsMenu() {
  const { role } = useAuth();
  const isEmployer = role === "COMPANY_OWNER";
  const [open, setOpen] = useState(false);
  const t = useT();
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // New when the panel was last opened: already saved as read, still shown
  // highlighted while the panel stays open.
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Where the panel sits on screen: just under the bell, right edges lined
  // up, never past the window's edge. It's rendered into <body> (a portal)
  // because the header's nav row scrolls sideways on phones, and a
  // scrolling box clips anything inside it — the panel used to open
  // invisibly inside that 55px-tall row.
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);

  const placePanel = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPanelPos({ top: Math.round(rect.bottom + 8), right: Math.max(12, Math.round(window.innerWidth - rect.right)) });
  }, []);

  // Saves every new notification this account can see as read and returns
  // the list with them marked so (see the component comment).
  const markSeen = useCallback(
    (list: AppNotification[]): AppNotification[] => {
      const ids = list
        .filter((n) => n.unread && (isEmployer || CATEGORY_BY_KIND[n.kind] !== "EMPLOYER"))
        .map((n) => n.id);
      if (ids.length === 0) return list;
      saveRead(ids);
      setFreshIds((prev) => new Set([...prev, ...ids]));
      return list.map((n) => (ids.includes(n.id) ? { ...n, unread: false } : n));
    },
    [isEmployer],
  );

  // seen = the panel is open, so whatever arrives is being looked at.
  const load = useCallback(
    (seen: boolean) => {
      apiGet<ApiNotification[]>("/me/notifications")
        .then((real) => {
          setLoadFailed(false);
          const list = real.map(toAppNotification).sort(byNewestFirst);
          setNotifications(seen ? markSeen(list) : list);
        })
        .catch(() => {
          setLoadFailed(true);
        });
    },
    [markSeen],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    const refresh = () => load(open);
    window.addEventListener(NOTIFICATIONS_STALE_EVENT, refresh);
    return () => window.removeEventListener(NOTIFICATIONS_STALE_EVENT, refresh);
  }, [load, open]);

  useEffect(() => {
    if (!open) return;
    load(true);
    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
    };
  }, [open, load, placePanel]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
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

  // Opening: what's already loaded is seen right away, so the counter is
  // gone the moment the panel appears (the refetch that follows covers
  // anything newer).
  function toggleOpen() {
    if (!open) {
      setFreshIds(new Set());
      if (notifications) setNotifications(markSeen(notifications));
    }
    setOpen((v) => !v);
  }

  // Also drops the "new" highlight from the rows that were new on opening.
  function markAllRead() {
    saveRead((notifications ?? []).filter((n) => n.unread).map((n) => n.id));
    setNotifications((prev) => prev?.map((n) => ({ ...n, unread: false })) ?? prev);
    setFreshIds(new Set());
  }

  function markOneRead(id: string) {
    if (notifications?.find((n) => n.id === id)?.unread) saveRead([id]);
    setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, unread: false } : n)) ?? prev);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative font-sans">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-label={t("Notifications")}
        aria-expanded={open}
        title={t("Notifications")}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
      >
        <BellIcon className="h-[22px] w-[22px]" />
        {unreadCount > 0 && (
          <span
            data-unread-badge
            className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-background"
            aria-hidden="true"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t("Notifications")}
          style={{ top: panelPos?.top ?? 72, right: panelPos?.right ?? 12 }}
          className="fixed z-50 w-96 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl bg-surface font-sans shadow-xl ring-1 ring-border"
        >
          <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-4">
            <h2 className="font-grotesk text-[17px] font-semibold text-foreground">{t("Notifications")}</h2>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0 && freshIds.size === 0}
              className="text-[12.5px] font-medium text-muted-foreground transition hover:text-brand-600 disabled:cursor-default disabled:opacity-40 disabled:hover:text-muted-foreground dark:hover:text-brand-400"
            >
              {t("Mark all as read")}
            </button>
          </div>

          {visible === null && loadFailed ? (
            <p className="px-4 pb-6 pt-4 text-center text-sm text-muted-foreground">
              {t("Couldn't load your notifications. Please try again in a moment.")}
            </p>
          ) : visible === null ? (
            <div className="flex flex-col gap-1 px-2 pb-3" aria-label={t("Loading...")}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2.5 py-2.5">
                  <span className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-surface-muted" />
                  <span className="h-3 flex-1 animate-pulse rounded-full bg-surface-muted" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 pb-8 pt-5 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-muted text-muted-foreground">
                <BellIcon className="h-5 w-5" />
              </span>
              <p className="text-sm text-muted-foreground">{t("You have no new notifications.")}</p>
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto px-2 pb-2">
              {splitByDay(visible).map((group) => (
                <section key={group.label} className="pb-1">
                  <p className="px-2.5 pb-1 pt-2 text-[11.5px] font-medium text-muted-foreground">{t(group.label)}</p>
                  <ul className="flex flex-col">
                    {group.items.map((n) => (
                      <NotificationRow key={n.id} n={freshIds.has(n.id) ? { ...n, unread: true } : n} onOpen={markOneRead} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>,
          document.body,
        )}
    </div>
  );
}
