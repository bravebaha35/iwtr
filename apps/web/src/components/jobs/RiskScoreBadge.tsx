// Worker-facing accountability signal: riskScore increments (server-side,
// see JobPostingsService.create) when a company reposts the exact same
// title+workType after marking an earlier identical posting FILLED. A clean
// company (riskScore 0) shows nothing at all — this deliberately avoids
// cluttering every card with "Risk Score: 0/3".
export function RiskScoreBadge({ riskScore }: { riskScore: number }) {
  if (riskScore === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400"
      title="This company has reposted an identical role after marking a prior posting filled"
    >
      {Array.from({ length: riskScore }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
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
      ))}
      Risk Score: {riskScore}/3
    </span>
  );
}
