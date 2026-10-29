"use client";

import { useT } from "@/lib/i18n/client";

// Worker-facing accountability signal: riskScore increments (server-side,
// see JobPostingsService.create) when a company reposts the exact same
// title+workType after marking an earlier identical posting FILLED. Shown
// by default on every company now (not hidden at 0) — "-" is the distinct
// "no data yet" state for a card/page with no real, appliable job posting
// behind it, not the same thing as a clean 0.
export const RISK_SCORE_NOTES: Record<number, string> = {
  0: "No repeat postings for the same role — a clean track record so far.",
  1: "This company has reposted an identical role once after marking a prior posting as filled.",
  2: "This company has reposted an identical role twice after marking prior postings as filled.",
  3: "Maximum Risk Score — this company has repeatedly reposted identical roles after marking them filled.",
};

// The one-word name a job card shows for each score (owner's words,
// 2026-10-25; no full stop or "!" since 2026-10-29. Turkish: Mantıklı / Olur /
// Eh / Dikkat).
// A card for a company with no real posting shows no Risk Score at all
// (the save button takes its place); the company page still says "-".
export const RISK_SCORE_WORDS: Record<number, string> = {
  0: "Reasonable",
  1: "Okay",
  2: "Meh",
  3: "Caution",
};

// What a Risk Score badge says when the pointer rests on it: one short line
// (the owner asked for "You can safely apply here !" style, 2026-10-29). The
// longer RISK_SCORE_NOTES stay for the Risk Score filter's explanation.
export const RISK_SCORE_SHORT_NOTES: Record<number, string> = {
  0: "You can safely apply here !",
  1: "Fine, one role was reopened once.",
  2: "Think twice, roles keep reopening.",
  3: "Be careful before applying !",
};

export const NO_OPEN_POSTING_NOTE =
  "This company hasn't posted a job opening yet, so there's no repost history to show.";

// Shared green→orange→red severity scale, also used by the Risk Score
// filter slider's tick icons in JobsBrowser.tsx so the two stay visually
// consistent.
export function riskScoreColorClass(riskScore: number): string {
  if (riskScore === 0) return "text-green-700 dark:text-green-400";
  if (riskScore === 1) return "text-amber-700 dark:text-amber-400";
  if (riskScore === 2) return "text-orange-700 dark:text-orange-400";
  return "text-red-600 dark:text-red-300";
}

export function RiskTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// "short" is the job-card form: just the score's word ("Meh") in its colour, no
// warning icons. Screen readers still hear the full "Risk Score 2 of 3".
// Renders nothing when there is no score yet.
export function RiskScoreBadge({
  riskScore,
  className,
  short = false,
}: {
  riskScore: number | null;
  className?: string;
  short?: boolean;
}) {
  const t = useT();
  const note = riskScore === null ? t(NO_OPEN_POSTING_NOTE) : t(RISK_SCORE_SHORT_NOTES[riskScore]);
  if (short) {
    if (riskScore === null) return null;
    return (
      <span
        className={`inline-flex text-xs font-semibold ${className ?? ""}`}
        title={note}
      >
        <span aria-hidden="true" className={riskScoreColorClass(riskScore)}>
          {t(RISK_SCORE_WORDS[riskScore])}
        </span>
        <span className="sr-only">{t("Risk Score {n} of 3", { n: riskScore })}</span>
      </span>
    );
  }
  if (riskScore === null) {
    return (
      <span
        className={`text-xs font-semibold text-muted-foreground ${className ?? ""}`}
        title={note}
      >
        {t("Risk Score")}: -
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${riskScoreColorClass(riskScore)} ${className ?? ""}`}
      title={note}
    >
      {Array.from({ length: riskScore }, (_, i) => (
        <RiskTriangleIcon key={i} className="h-3.5 w-3.5" />
      ))}
      {t("Risk Score")}: {riskScore}/3
    </span>
  );
}
