"use client";

import { usePathname, useRouter } from "next/navigation";

// Global, single mount point (rendered once from layout.tsx), mirroring
// SettingsPanel's top-right placement — so every page gets a consistent
// way back without each page cluttering its own content with a "← Back"
// link. Hidden on the homepage since there's nowhere meaningful to go
// back to from the app's root.
export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/") return null;

  return (
    <div className="fixed top-4 left-4 z-50">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Go back"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition hover:bg-surface-muted"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
    </div>
  );
}
