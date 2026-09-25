"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

export type SettingsNavItem<K extends string> =
  | { key: K; label: string }
  // A real route rather than a locally-switched tab (e.g. the owner
  // dashboard's Job Postings page).
  | { key: string; label: string; href: string };

// Fast, sharp settle rather than a soft ease-in-out fade.
const HOVER_TRANSITION = { duration: 0.12, ease: [0.2, 0.9, 0.1, 1] as const };

// Fixed class strings only — nothing here is ever built from user input.
const ITEM_BASE =
  "block w-full whitespace-nowrap rounded-full px-3 py-2 text-left text-sm font-medium transition-colors";
const ITEM_IDLE = `${ITEM_BASE} text-sidebar-foreground/80 hover:bg-black/5 hover:text-sidebar-foreground dark:hover:bg-white/10`;
const ITEM_ACTIVE = `${ITEM_BASE} bg-brand-600 text-white`;

/**
 * The sidebar panel (light in light mode, dark in dark mode) for the settings-style pages (/me and
 * the /my/companies owner dashboard). Renders its own <aside>, so the page
 * places it as a sibling of the content column instead of inside any card.
 * Horizontal scrolling tab strip on mobile, vertical list from sm: up.
 */
export function SettingsNav<K extends string>({
  label,
  items,
  active,
  onChange,
}: {
  label: string;
  items: SettingsNavItem<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  const reduceMotion = useReducedMotion();
  const hover = reduceMotion ? undefined : { x: 4 };

  return (
    <aside className="shrink-0 sm:w-56">
      <nav
        aria-label={label}
        className="flex flex-row gap-1 overflow-x-auto rounded-2xl border border-border bg-sidebar p-2 sm:flex-col sm:overflow-visible"
      >
        {items.map((item) => {
          if ("href" in item) {
            return (
              <motion.div key={item.key} whileHover={hover} transition={HOVER_TRANSITION}>
                <Link href={item.href} className={ITEM_IDLE}>
                  {item.label}
                </Link>
              </motion.div>
            );
          }
          const isActive = item.key === active;
          return (
            <motion.div key={item.key} whileHover={hover} transition={HOVER_TRANSITION}>
              <button
                type="button"
                onClick={() => onChange(item.key)}
                aria-current={isActive ? "page" : undefined}
                className={isActive ? ITEM_ACTIVE : ITEM_IDLE}
              >
                {item.label}
              </button>
            </motion.div>
          );
        })}
      </nav>
    </aside>
  );
}
