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

export const NO_OPEN_POSTING_NOTE =
  "This company hasn't posted a job opening yet, so there's no repost history to show.";

// Shared green→orange→red severity scale, also used by the Risk Score
// filter slider's tick icons in JobsBrowser.tsx so the two stay visually
// consistent.
export function riskScoreColorClass(riskScore: number): string {
  if (riskScore === 0) return "text-green-600 dark:text-green-400";
  if (riskScore === 1) return "text-amber-500 dark:text-amber-400";
  if (riskScore === 2) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
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

export function RiskScoreBadge({ riskScore, className }: { riskScore: number | null; className?: string }) {
  if (riskScore === null) {
    return (
      <span
        className={`text-xs font-semibold text-muted-foreground ${className ?? ""}`}
        title={NO_OPEN_POSTING_NOTE}
      >
        Risk Score: -
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${riskScoreColorClass(riskScore)} ${className ?? ""}`}
      title={RISK_SCORE_NOTES[riskScore]}
    >
      {Array.from({ length: riskScore }, (_, i) => (
        <RiskTriangleIcon key={i} className="h-3.5 w-3.5" />
      ))}
      Risk Score: {riskScore}/3
    </span>
  );
}
