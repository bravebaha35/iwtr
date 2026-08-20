import type { WorkplaceType } from "@iwtr/shared-types";

// Presentation-only color coding for the "Color-Coded Collar Filtering
// Tabs" UI: each workplace type ("collar") gets a distinct Tailwind color so
// the active filter tab and the review cards it filters to visually agree
// at a glance. Kept separate from workplaceTypes.ts (which only owns
// display labels) so retuning the palette later is a one-file change, same
// principle as scoreBandColors.ts.
export const collarColorMap: Record<WorkplaceType, { text: string; border: string }> = {
  MANUAL_LABOUR: { text: "text-blue-600", border: "border-blue-600" },
  // #fffff0 is near-white (ivory) — same hex used for both text and border
  // here, unlike the badge/border-only uses elsewhere that pair it with a
  // dark #450011 fill; there's no fill to pair against on an outline pill.
  OFFICE: { text: "text-[#fffff0]", border: "border-[#fffff0]" },
  HYBRID_REMOTE: { text: "text-teal-600", border: "border-teal-600" },
  SERVICE: { text: "text-[#450011]", border: "border-[#450011]" },
};

// Inactive collar pills are neutral/greyed-out by design — every type looks
// the same (same treatment as the app's plain default pill) until clicked,
// at which point its own color takes over. Showing every option in full
// color at once (the original spec) read as too busy in practice; the color
// is meant to be the *result* of picking a type, not a hint shown up front.
const inactiveCollarPillClassName = "border border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground";

// Active pills used to be a solid color fill (bg + white/dark text) — per
// explicit user request, only the outline (border) and label carry the
// color now; the inside stays the plain surface background, same as every
// other pill in the app.
export function collarPillClassName(type: WorkplaceType, active: boolean): string {
  if (!active) return inactiveCollarPillClassName;
  const { text, border } = collarColorMap[type];
  return `border-2 ${border} ${text} bg-surface`;
}

export function collarBorderClass(type: WorkplaceType): string {
  return collarColorMap[type].border;
}
