import { RewindButton } from "@/components/RewindButton";

// Base (colorless) class strings for the two pill shapes, shared between the
// default brand-colored look and any per-option color override (e.g. the
// collar color map) — a color override only ever swaps the color half of
// the class string, never the shape/spacing half.
const wrapPillBaseClass =
  "rounded-full px-3 py-1.5 compact:px-2.5 compact:py-1 text-sm compact:text-xs font-medium transition";
// Smaller, boxier shape used by the "grid" layout — text-only, centered, and
// allowed to wrap onto a second line (break-words) rather than overflow past
// the box edges, since a fixed two-column grid gives each pill a narrow,
// fixed width regardless of label length (e.g. "Hybrid/Remote").
const gridPillBaseClass =
  "flex w-full min-w-0 items-center justify-center break-words rounded-xl px-2 py-2 text-center text-xs font-light leading-tight transition";

// Single shared building block for every button-style filter in the app —
// restyling how an active/inactive filter pill looks is a one-function
// change here (pillClass) rather than hunting down each filter's own copy of
// the class string.
export function pillClass(active: boolean): string {
  return `${wrapPillBaseClass} ${
    active ? "bg-brand-600 text-white" : "border border-border text-muted-foreground hover:bg-surface-muted"
  }`;
}

function gridPillClass(active: boolean): string {
  return `${gridPillBaseClass} ${
    active ? "bg-brand-600 text-white" : "border border-border text-foreground hover:bg-surface-muted"
  }`;
}

// Single-select tab group — exactly one option (or "All") is active at a
// time, unlike MultiFilterPillGroup's independent per-option toggles. Used
// by the company page's color-coded collar/workplace-type filter tabs.
export function SingleSelectPillTabs<T extends string>({
  options,
  selected,
  onSelect,
  allLabel = "All",
  // Optional per-option color override (e.g. the collar color map) so a
  // specific tab group can render each option in a distinct color instead
  // of the shared default brand color. Omit to keep the plain pillClass
  // look every other filter in the app uses.
  pillColorClassName,
}: {
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (value: T | null) => void;
  allLabel?: string;
  pillColorClassName?: (value: T, active: boolean) => string;
}) {
  const basePillClass =
    "rounded-full px-3 py-1.5 compact:px-2.5 compact:py-1 text-sm compact:text-xs font-medium transition";
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => onSelect(null)} className={pillClass(selected === null)}>
        {allLabel}
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onSelect(o.value)}
          className={
            pillColorClassName
              ? `${basePillClass} ${pillColorClassName(o.value, selected === o.value)}`
              : pillClass(selected === o.value)
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Multi-select filter pill group. The rewind button next to the heading is
// a pure reset — clears back to no selection (which, since every filter
// here is additive server-side, is the same thing as "show everything") —
// not a toggle into a "every option selected" state.
export function MultiFilterPillGroup<T extends string>({
  heading,
  options,
  selected,
  onToggle,
  onReset,
  direction = "wrap",
  pillColorClassName,
}: {
  heading: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  onReset: () => void;
  // "grid" lines pills up in a fixed 2-column grid instead of letting them
  // wrap wherever they happen to fit — a narrow sidebar with mixed-length
  // labels (e.g. "Hybrid/Remote") wraps unevenly under plain flex-wrap,
  // leaving a lone pill stranded on its own row. The grid keeps every row
  // the same two-column shape regardless of label length.
  direction?: "wrap" | "column" | "grid";
  // Optional per-option color override (e.g. the collar color map) — lets
  // this specific group render each option in a distinct color instead of
  // the shared default brand color. Omit to keep every other consumer's
  // plain look unchanged.
  pillColorClassName?: (value: T, active: boolean) => string;
}) {
  const layoutClassName =
    direction === "column"
      ? "flex flex-row flex-wrap gap-1.5 sm:flex-col"
      : direction === "grid"
        ? "grid grid-cols-2 gap-1.5"
        : "flex flex-wrap gap-1.5";
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</h3>
        <RewindButton onClick={onReset} active={selected.length > 0} title={`Clear ${heading} filter`} />
      </div>
      <div className={layoutClassName}>
        {options.map((o) => {
          const active = selected.includes(o.value);
          const className = pillColorClassName
            ? `${direction === "grid" ? gridPillBaseClass : wrapPillBaseClass} ${pillColorClassName(o.value, active)}`
            : direction === "grid"
              ? gridPillClass(active)
              : pillClass(active);
          return (
            <button key={o.value} type="button" onClick={() => onToggle(o.value)} className={className}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
