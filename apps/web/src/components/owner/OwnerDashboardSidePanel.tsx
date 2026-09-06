"use client";

export type OwnerDashboardCategory = "general-info" | "contact-social" | "reviews-ratings";

const CATEGORIES: { key: OwnerDashboardCategory; label: string }[] = [
  { key: "general-info", label: "General Information" },
  { key: "contact-social", label: "Contact & Social Media" },
  { key: "reviews-ratings", label: "Reviews & Ratings" },
];

/**
 * Left-side vertical nav on desktop, sticky horizontal tab bar on mobile —
 * the 3 fixed categories every approved-owner company card is organized
 * under (see sections/*.tsx). Purely a controlled tab switcher; every field
 * and save action still lives in the category components themselves.
 */
export function OwnerDashboardSidePanel({
  active,
  onChange,
}: {
  active: OwnerDashboardCategory;
  onChange: (category: OwnerDashboardCategory) => void;
}) {
  return (
    <nav
      aria-label="Company dashboard sections"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900 sm:w-56 sm:flex-col sm:overflow-visible sm:rounded-xl sm:border sm:p-3"
    >
      {CATEGORIES.map((c) => {
        const isActive = c.key === active;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium transition sm:shrink ${
              isActive
                ? "bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200"
                : "text-foreground hover:bg-surface-muted"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </nav>
  );
}
