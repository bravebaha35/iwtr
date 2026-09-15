// Same path SocialSidebar.tsx's own local BookmarkIcon uses, promoted to a
// shared file since this plan needs it in two more places (JobCard.tsx's
// per-posting save button, JobsBrowser.tsx's Saved Posts toggle) — real,
// concrete reuse, not speculative. SocialSidebar.tsx's own copy is
// untouched; that component is outside this feature's scope.
export function BookmarkIcon({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
