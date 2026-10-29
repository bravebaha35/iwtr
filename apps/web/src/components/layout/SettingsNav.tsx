"use client";

import { useId } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useT } from "@/lib/i18n/client";

export type SettingsNavItem<K extends string> =
  // `note`: a short line under the label for something the reader should not
  // miss ("2 free ads left this month").
  | { key: K; label: string; note?: string | null }
  // A real route rather than a locally-switched tab (e.g. the owner
  // dashboard's Job Postings page).
  | { key: string; label: string; href: string };

// Fixed class strings only - nothing here is ever built from user input.
// Plain text rows, no filled pills: the selected row is marked by the brand
// selected colour (orange text + bar on the rail) (the same mark the header uses for the current page).
const ITEM_BASE =
  "relative block w-full whitespace-nowrap px-3 py-2.5 text-left text-[14.5px] leading-snug transition-colors duration-150 sm:whitespace-normal sm:py-2 sm:pl-5 sm:pr-2";
const ITEM_IDLE = `${ITEM_BASE} text-muted-foreground hover:text-foreground`;
const ITEM_ACTIVE = `${ITEM_BASE} font-semibold text-brand-700 dark:text-brand-300`;

// The selection bar: under the tab on the mobile strip, on the left rail
// from sm: up (sitting over the rail's hairline, hence -left-px).
const BAR =
  "pointer-events-none absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-600 sm:inset-x-auto sm:-left-px sm:top-1.5 sm:bottom-1.5 sm:h-auto sm:w-0.5";

const BAR_SPRING = { type: "spring", stiffness: 520, damping: 42 } as const;

/**
 * The side menu for the settings-style pages (/me and the /my/companies
 * owner dashboard) - both use this one component so they always match.
 * Renders its own <aside>, so the page places it as a sibling of the
 * content column instead of inside any card. A tab strip with an underline
 * on mobile, a vertical list on a hairline rail from sm: up.
 */
export function SettingsNav<K extends string>(props: {
  label: string;
  items: SettingsNavItem<K>[];
  active: K | null;
  onChange: (key: K) => void;
}) {
  return (
    <aside className="shrink-0 sm:w-56">
      <SettingsNavList {...props} />
    </aside>
  );
}

/**
 * Just the list, without the <aside> - for a page that builds its own aside
 * around it (the owner dashboard). `active` null = nothing here is selected.
 */
export function SettingsNavList<K extends string>({
  label,
  items,
  active,
  onChange,
}: {
  label: string;
  items: SettingsNavItem<K>[];
  active: K | null;
  onChange: (key: K) => void;
}) {
  const reduceMotion = useReducedMotion();
  const t = useT();
  // One bar per list, so two lists on a page never swap bars.
  const barId = useId();

  return (
    <nav
      aria-label={t(label)}
      className="flex flex-row overflow-x-auto border-b border-border sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-l"
    >
      {items.map((item) => {
        if ("href" in item) {
          return (
            <Link key={item.key} href={item.href} className={ITEM_IDLE}>
              {t(item.label)}
            </Link>
          );
        }
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-current={isActive ? "page" : undefined}
            className={isActive ? ITEM_ACTIVE : ITEM_IDLE}
          >
            {isActive && (
              <motion.span
                layoutId={`settings-nav-bar-${barId}`}
                transition={reduceMotion ? { duration: 0 } : BAR_SPRING}
                className={BAR}
                aria-hidden="true"
              />
            )}
            {t(item.label)}
            {item.note && (
              <span className="mt-0.5 block text-xs font-bold text-foreground/80">{t(item.note)}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
