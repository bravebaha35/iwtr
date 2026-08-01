// Single shared building block for every button-style filter in the app
// (workplace type, city, and any future filter axis) — restyling how an
// active/inactive filter pill looks is a one-function change here (pillClass)
// rather than hunting down each filter's own copy of the class string.
function pillClass(active: boolean): string {
  return `rounded-full px-3 py-1.5 text-sm font-medium transition ${
    active
      ? "bg-brand-600 text-white"
      : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
  }`;
}

export function FilterPillGroup<T extends string>({
  heading,
  allLabel,
  options,
  selected,
  onSelect,
  direction = "wrap",
}: {
  heading: string;
  allLabel: string;
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (value: T | null) => void;
  direction?: "wrap" | "column";
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{heading}</h3>
      <div className={`flex gap-1.5 ${direction === "column" ? "flex-row flex-wrap sm:flex-col" : "flex-wrap"}`}>
        <button type="button" onClick={() => onSelect(null)} className={pillClass(selected === null)}>
          {allLabel}
        </button>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onSelect(o.value)}
            className={pillClass(selected === o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
