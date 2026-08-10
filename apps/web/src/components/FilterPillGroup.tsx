// Single shared building block for every button-style filter in the app —
// restyling how an active/inactive filter pill looks is a one-function
// change here (pillClass) rather than hunting down each filter's own copy of
// the class string.
export function pillClass(active: boolean): string {
  return `rounded-full px-3 py-1.5 compact:px-2.5 compact:py-1 text-sm compact:text-xs font-medium transition ${
    active ? "bg-brand-600 text-white" : "border border-border text-muted-foreground hover:bg-surface-muted"
  }`;
}

// Smaller, boxier pill used by the "grid" layout — text-only, centered, and
// allowed to wrap onto a second line (break-words) rather than overflow past
// the box edges, since a fixed two-column grid gives each pill a narrow,
// fixed width regardless of label length (e.g. "Hybrid/Remote").
function gridPillClass(active: boolean): string {
  return `flex w-full min-w-0 items-center justify-center break-words rounded-xl px-2 py-2 text-center text-xs font-light leading-tight transition ${
    active ? "bg-brand-600 text-white" : "border border-border text-foreground hover:bg-surface-muted"
  }`;
}

// Multi-select filter pill group. The "All" pill is always the first item —
// clicking it clears the selection (equivalent to "no filter applied"), so
// picking individual values and picking "All" are mutually exclusive states.
export function MultiFilterPillGroup<T extends string>({
  heading,
  options,
  selected,
  onToggle,
  onClearAll,
  direction = "wrap",
}: {
  heading: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  onClearAll: () => void;
  // "grid" lines pills up in a fixed 2-column grid instead of letting them
  // wrap wherever they happen to fit — a narrow sidebar with mixed-length
  // labels (e.g. "All" next to "Hybrid/Remote") wraps unevenly under plain
  // flex-wrap, leaving a lone pill stranded on its own row. The grid keeps
  // every row the same two-column shape regardless of label length.
  direction?: "wrap" | "column" | "grid";
}) {
  const layoutClassName =
    direction === "column"
      ? "flex flex-row flex-wrap gap-1.5 sm:flex-col"
      : direction === "grid"
        ? "grid grid-cols-2 gap-1.5"
        : "flex flex-wrap gap-1.5";
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</h3>
      <div className={layoutClassName}>
        <button
          type="button"
          onClick={onClearAll}
          className={direction === "grid" ? gridPillClass(selected.length === 0) : pillClass(selected.length === 0)}
        >
          All
        </button>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={direction === "grid" ? gridPillClass(selected.includes(o.value)) : pillClass(selected.includes(o.value))}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
