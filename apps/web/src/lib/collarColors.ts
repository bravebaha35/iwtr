import type { WorkplaceType } from "@iwtr/shared-types";

// Presentation-only color coding for the "Color-Coded Collar Filtering
// Tabs" UI: each workplace type ("collar") gets a distinct Tailwind color so
// the active filter tab and the review cards it filters to visually agree
// at a glance. Kept separate from workplaceTypes.ts (which only owns
// display labels) so retuning the palette later is a one-file change, same
// principle as scoreBandColors.ts.
export const collarColorMap: Record<WorkplaceType, { active: string; border: string }> = {
  MANUAL_LABOUR: { active: "bg-blue-600 text-white", border: "border-blue-600" },
  // #fffff0 is near-white (ivory) — needs dark text to stay readable,
  // unlike the other 3 types' solid, saturated actives which all pair with
  // white text.
  OFFICE: { active: "bg-[#fffff0] text-[#450011]", border: "border-[#fffff0]" },
  HYBRID_REMOTE: { active: "bg-teal-600 text-white", border: "border-teal-600" },
  SERVICE: { active: "bg-[#450011] text-white", border: "border-[#450011]" },
};

// Inactive collar pills are neutral/greyed-out by design — every type looks
// the same (same treatment as the app's plain default pill) until clicked,
// at which point its own color takes over. Showing every option in full
// color at once (the original spec) read as too busy in practice; the color
// is meant to be the *result* of picking a type, not a hint shown up front.
const inactiveCollarPillClassName = "border border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground";

export function collarPillClassName(type: WorkplaceType, active: boolean): string {
  return active ? collarColorMap[type].active : inactiveCollarPillClassName;
}

export function collarBorderClass(type: WorkplaceType): string {
  return collarColorMap[type].border;
}
