// Shared by GlobalHeader's nav links and NotificationsMenu's trigger so every
// slot in the nav row has the same shape: icon and label side by side on one
// line, full header height, no box. The current page is marked by a Wood bar
// on the header's bottom edge (navItemActiveClass) rather than a filled pill.
export const navItemClass =
  "relative flex h-16 shrink-0 items-center gap-2 px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:px-3";
export const navItemActiveClass =
  "text-foreground after:absolute after:inset-x-2.5 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-brand-600 dark:after:bg-brand-400 lg:after:inset-x-3";
// Icons only below lg (the label stays for screen readers).
export const navItemLabelClass = "sr-only lg:not-sr-only";
