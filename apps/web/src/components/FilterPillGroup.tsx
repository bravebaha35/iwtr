// Single shared building block for every button-style filter in the app —
// restyling how an active/inactive filter pill looks is a one-function
// change here (pillClass) rather than hunting down each filter's own copy of
// the class string.
export function pillClass(active: boolean): string {
  return `rounded-full px-3 py-1.5 compact:px-2.5 compact:py-1 text-sm compact:text-xs font-medium transition ${
    active ? "bg-brand-600 text-white" : "border border-border text-muted-foreground hover:bg-surface-muted"
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
  direction?: "wrap" | "column";
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</h3>
      <div className={`flex gap-1.5 ${direction === "column" ? "flex-row flex-wrap sm:flex-col" : "flex-wrap"}`}>
        <button type="button" onClick={onClearAll} className={pillClass(selected.length === 0)}>
          All
        </button>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={pillClass(selected.includes(o.value))}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
