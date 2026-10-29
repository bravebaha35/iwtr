// The shape of every slot in GlobalHeader's nav row: icon and label side by
// side on one line, full header height, no box. The current page is marked by the brand selected colour: text and a bar
// on the header's bottom edge (navItemActiveClass) rather than a filled pill.
export const navItemClass =
  "relative flex h-16 shrink-0 items-center gap-2 px-2.5 text-sm font-medium transition-colors lg:px-3";
// Colour lives in exactly one of these two, never both: two text colours on
// one element race in the stylesheet (the idle grey used to win).
export const navItemIdleClass = "text-muted-foreground hover:text-foreground";
export const navItemActiveClass =
  "text-brand-700 dark:text-brand-300 after:absolute after:inset-x-2.5 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-brand-600 dark:after:bg-brand-400 lg:after:inset-x-3";
// Icons only below lg (the label stays for screen readers).
export const navItemLabelClass = "sr-only lg:not-sr-only";
