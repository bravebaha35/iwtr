import type { WorkplaceType } from "@iwtr/shared-types";

// Presentation-only color coding for the "Color-Coded Collar Filtering
// Tabs" UI: each workplace type ("collar") gets a distinct Tailwind color so
// the active filter tab and the review cards it filters to visually agree
// at a glance. Kept separate from workplaceTypes.ts (which only owns
// display labels) so retuning the palette later is a one-file change, same
// principle as scoreBandColors.ts.
export const collarColorMap: Record<WorkplaceType, { text: string; border: string; borderLeft: string }> = {
  MANUAL_LABOUR: { text: "text-blue-600", border: "border-blue-600", borderLeft: "border-l-blue-600" },
  // #fffff0 is near-white (ivory) — same hex used for both text and border
  // here, unlike the badge/border-only uses elsewhere that pair it with a
  // dark #450011 fill; there's no fill to pair against on an outline pill.
  OFFICE: { text: "text-[#fffff0]", border: "border-[#fffff0]", borderLeft: "border-l-[#fffff0]" },
  HYBRID_REMOTE: { text: "text-teal-600", border: "border-teal-600", borderLeft: "border-l-teal-600" },
  SERVICE: { text: "text-[#450011]", border: "border-[#450011]", borderLeft: "border-l-[#450011]" },
};

// The review filter's work-type pills used to take these colours when picked;
// since 2026-10-29 every picked pill uses the one brand selected colour
// (FilterPillGroup's pillClass), so the colours here only mark review cards.

// Used for the review card's left accent border only (border-l-2 in
// ReviewsList.tsx) — deliberately the per-side `border-l-*` utility, not the
// all-sides `border` field above. That card also carries a plain `border
// border-border` for its other 3 sides; two same-specificity `border-color`
// (all-sides) utilities on one element race in Tailwind's generated
// stylesheet with no reliable winner — verified live that `border-border`
// was winning, silently leaving every review card's accent colorless. A
// per-side longhand (`border-left-color`) reliably overrides the shorthand
// regardless of class order, which is why this exists as a separate field
// instead of reusing `border` for both purposes.
export function collarBorderClass(type: WorkplaceType): string {
  return collarColorMap[type].borderLeft;
}

// Each work type's own hue, as a soft wash and as a full-strength bar - for
// marks that NAME a work type (the avatar picker's dots, a job's work-type
// bar). Not for showing what is picked: a picked tile or tab uses the one
// brand selected colour (2026-10-29). Hues unchanged (Office slate, Hybrid/Remote teal,
// Service orange, Manual-Labour blue), one step lighter in dark mode so
// they stay readable on the dark page.
export const collarTileTone: Record<WorkplaceType, { wash: string; bar: string }> = {
  OFFICE: { wash: "bg-slate-500/20 dark:bg-slate-300/20", bar: "bg-slate-700 dark:bg-slate-300" },
  HYBRID_REMOTE: { wash: "bg-teal-600/15 dark:bg-teal-400/20", bar: "bg-teal-600 dark:bg-teal-400" },
  SERVICE: { wash: "bg-orange-600/15 dark:bg-orange-400/20", bar: "bg-orange-600 dark:bg-orange-400" },
  MANUAL_LABOUR: { wash: "bg-blue-600/15 dark:bg-blue-400/20", bar: "bg-blue-600 dark:bg-blue-400" },
};
