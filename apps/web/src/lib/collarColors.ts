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

// Inactive collar pills are neutral/greyed-out by design — every type looks
// the same (same treatment as the app's plain default pill) until clicked,
// at which point its own color takes over. Showing every option in full
// color at once (the original spec) read as too busy in practice; the color
// is meant to be the *result* of picking a type, not a hint shown up front.
const inactiveCollarPillClassName = "border border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground";

// Active pills used to be a solid color fill (bg + white/dark text), then a
// colored outline + colored label — per explicit user request, only the
// outline (border) carries the color now; the label stays plain foreground
// text like every other pill, and the inside stays the plain surface
// background.
export function collarPillClassName(type: WorkplaceType, active: boolean): string {
  if (!active) return inactiveCollarPillClassName;
  const { border } = collarColorMap[type];
  return `border ${border} text-foreground bg-surface`;
}

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

// Selected state of the stand-alone Work-Type buttons (homepage/Jobs
// Work-Type filter, IWT Social's "Only Show Me"). Outline-only, per explicit
// user request (a solid fill read as too heavy): the 1px border plus an
// inset 1px ring in the collar color, so a picked option stands out from
// the plain unselected outlines even for Office, whose slate-700 is close
// to the default border color. Hues unchanged: Office slate-700,
// Hybrid/Remote teal-600, Service orange-600, Manual-Labour blue-600.
const collarSegmentActiveClass: Record<WorkplaceType, string> = {
  OFFICE: "border border-slate-700 ring-1 ring-inset ring-slate-700 font-semibold text-foreground bg-surface",
  HYBRID_REMOTE: "border border-teal-600 ring-1 ring-inset ring-teal-600 font-semibold text-foreground bg-surface",
  SERVICE: "border border-orange-600 ring-1 ring-inset ring-orange-600 font-semibold text-foreground bg-surface",
  MANUAL_LABOUR: "border border-blue-600 ring-1 ring-inset ring-blue-600 font-semibold text-foreground bg-surface",
};

// Unselected: every option always carries its own plain 1px outline, like a
// button, instead of sitting borderless inside a shared track box.
const collarOutlinedInactiveClass =
  "border border-border bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground";

export function collarOutlinedButtonClassName(type: WorkplaceType, active: boolean): string {
  return active ? collarSegmentActiveClass[type] : collarOutlinedInactiveClass;
}
