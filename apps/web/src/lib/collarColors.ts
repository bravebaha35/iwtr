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
  return `border-2 ${border} text-foreground bg-surface`;
}

// Used for the review card's left accent border only (border-l-4 in
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

// "Mode B" strict segmented-control palette — deliberately a separate
// export from collarColorMap/collarPillClassName above (an outline-only
// style used by WorkplaceVibeFlags.tsx's tabs and ReviewsList.tsx's accent
// border), not a replacement for it. Solid fill + white text per collar,
// for the recessed WorkType filter track on the homepage/jobs page only.
// Exact values per design: Office slate-700 (#334155), Hybrid/Remote
// teal-600 (#0D9488), Service orange-600 (#EA580C), Manual-Labour blue-600
// (#2563EB) — plain Tailwind defaults, not custom hex. Unlike the track's
// own background (see trackWrapperClass in FilterPillGroup.tsx), these
// stay the same solid fill in both themes — a saturated color + white text
// reads fine regardless of what's behind it, so no dark: variant needed.
const collarSegmentActiveClass: Record<WorkplaceType, string> = {
  OFFICE: "bg-slate-700 text-white",
  HYBRID_REMOTE: "bg-teal-600 text-white",
  SERVICE: "bg-orange-600 text-white",
  MANUAL_LABOUR: "bg-blue-600 text-white",
};

// Borderless ash text — same "color is the result of selection, not a hint
// shown up front" reasoning as inactiveCollarPillClassName above. Darker
// zinc in light mode for real contrast against the track's light-mode
// background (zinc-400 on a light track reads too washed out).
const collarSegmentInactiveClass = "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200";

export function collarSegmentClassName(type: WorkplaceType, active: boolean): string {
  return active ? collarSegmentActiveClass[type] : collarSegmentInactiveClass;
}
