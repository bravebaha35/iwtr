// Shared by WorkplaceBrowser.tsx (the rating homepage) and JobsBrowser.tsx
// (the Jobs page) — unlike the state/filtering logic those two files keep as
// deliberate near-duplicates (see JobsBrowser.tsx's file-header comment),
// this icon set + button config + matcher is pure presentation with no
// per-page behavior to diverge, so it lives here once, same as
// collarColors.ts/scoreBandColors.ts/workplaceTypes.ts already do for their
// own shared presentation concerns.

// Coarse, curated grouping over Company.category — distinct from (and
// combines with, ANDed) each page's free-text Sector dropdown's exact-category
// filter. "Firms" is everything NOT tagged with one of the other
// categories, matching exactly the category strings the nationwide
// CITY_BASED/REGION_BASED brand seed script writes (see
// apps/api/scripts/seed-nationwide-brands.ts) — every pre-existing company
// (finance, construction, tech, etc.) falls under Firms by exclusion, same
// as a company whose category happens to be spelled differently.
export type CategoryGroup = "FIRMS" | "SUPERMARKET" | "FRANCHISE" | "LOGISTICS" | "CLOTHING" | "SERVICE_PROVIDERS" | "OIL_ENERGY";
const NARROW_CATEGORY_GROUP_VALUES = [
  "Supermarket",
  "Franchise",
  "Logistics",
  "Clothing Retail",
  "Telecom",
  "Fuel & Energy",
];

// Icon-only pills — each button's old text label now lives in aria-label
// (screen readers) plus a custom hover/focus tooltip drawn next to the
// button (see the CategoryGroup render below) rather than the browser's
// native `title` tooltip, which is slower to appear and unstyled.
type IconProps = { className?: string };
function FileIcon({ className }: IconProps) {
  // "Checklist on a file" — the plain document outline plus three
  // checked-off list lines, so it doesn't read as an empty blank page.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="m7.25 12 1 1 2-2" />
      <path d="M11.75 12h4.5" />
      <path d="m7.25 15.5 1 1 2-2" />
      <path d="M11.75 15.5h4.5" />
      <path d="m7.25 19 1 1 2-2" />
      <path d="M11.75 19h3.5" />
    </svg>
  );
}
function ShoppingCartIcon({ className }: IconProps) {
  // Trapezoid basket with a cross-hatched grille (instead of a bare
  // outline) plus handle and wheels, so it reads as an actual wire cart.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h2l.7 3" />
      <path d="M5.6 6h15.4l-2.2 8.5a1.5 1.5 0 0 1-1.45 1.13H8.9a1.5 1.5 0 0 1-1.46-1.16Z" />
      <path d="M8.6 6v9.6M12 6v9.6M15.4 6v9.6" />
      <path d="M6.4 9.4h15M7.2 12.7h13.4" />
      <circle cx="10" cy="20" r="1.15" />
      <circle cx="17" cy="20" r="1.15" />
    </svg>
  );
}
function FrenchFriesIcon({ className }: IconProps) {
  // Fry box with a fold line for the paper-wrap seam and five uneven
  // sticks poking out, instead of four evenly-spaced lines.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 9V4.5M9.8 9V2.5M12 9V5M14.2 9V2.8M16.5 9V4.8" />
      <path d="M5 9h14l-2.1 12H7.1Z" />
      <path d="M6 12.2h12" />
    </svg>
  );
}
function ForkliftIcon({ className }: IconProps) {
  // Side-profile forklift: cab + wheels, a two-post mast, forks, and a
  // lifted pallet — swapped in for the cargo-crate icon per feedback.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13h9v5H2Z" />
      <circle cx="6" cy="19" r="1.3" />
      <circle cx="13" cy="19" r="1.3" />
      <path d="M12 18V6M15 18V6" />
      <path d="M12 6h3" />
      <path d="M12 10H5M12 13H5" />
      <path d="M4 8h4v6H4Z" />
    </svg>
  );
}
function TshirtIcon({ className }: IconProps) {
  // Classic t-shirt silhouette — collar notch, sleeve, and hem — for the
  // LC Waikiki / DeFacto / Koton clothing-brand grouping.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3 3 7l3 3 2-1.5V21h8V8.5L18 10l3-3-5-4-1.5 1.5a3 3 0 0 1-5 0Z" />
    </svg>
  );
}
function TelecomIcon({ className }: IconProps) {
  // Broadcast/signal tower — mast, two crossbars, a base, and a pair of
  // signal arcs off the tip — for the Türk Telekom / Turkcell Superonline /
  // Vodafone / TurkNet service-provider grouping.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <path d="M12 6v14" />
      <path d="M8.5 20h7" />
      <path d="M9.5 10h5" />
      <path d="M8.5 15h7" />
      <path d="M9 6.3a3.2 3.2 0 0 1 0-4.6" />
      <path d="M15 6.3a3.2 3.2 0 0 0 0-4.6" />
    </svg>
  );
}
function OilDropIcon({ className }: IconProps) {
  // Single teardrop outline with a small highlight glint — for the
  // TotalEnergies / Petrol Ofisi / Opet / Shell / Türkiye Petrolleri grouping.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c3.5 4.2 6 7.7 6 10.5a6 6 0 1 1-12 0C6 10.7 8.5 7.2 12 3Z" />
      <path d="M9.8 15.2a2.6 2.6 0 0 0 2.2 2.4" />
    </svg>
  );
}
export const CATEGORY_GROUP_BUTTONS: { value: CategoryGroup; label: string; icon: (props: IconProps) => React.JSX.Element }[] = [
  { value: "FIRMS", label: "Firms", icon: FileIcon },
  { value: "SUPERMARKET", label: "Supermarket", icon: ShoppingCartIcon },
  { value: "FRANCHISE", label: "Franchises", icon: FrenchFriesIcon },
  { value: "LOGISTICS", label: "Logistics", icon: ForkliftIcon },
  { value: "CLOTHING", label: "Clothing", icon: TshirtIcon },
  { value: "SERVICE_PROVIDERS", label: "Service Providers", icon: TelecomIcon },
  { value: "OIL_ENERGY", label: "Oil & Energy", icon: OilDropIcon },
];
export function matchesCategoryGroup(company: { category: string }, group: CategoryGroup | null): boolean {
  if (!group) return true;
  if (group === "FIRMS") return !NARROW_CATEGORY_GROUP_VALUES.includes(company.category);
  if (group === "SUPERMARKET") return company.category === "Supermarket";
  if (group === "FRANCHISE") return company.category === "Franchise";
  if (group === "LOGISTICS") return company.category === "Logistics";
  if (group === "CLOTHING") return company.category === "Clothing Retail";
  if (group === "SERVICE_PROVIDERS") return company.category === "Telecom";
  return company.category === "Fuel & Energy";
}

// The icon-pill row itself — identical markup on both pages (radiogroup of
// icon buttons + hover/focus tooltip, gone once a group is picked), so this
// is a real shared component, not just shared config.
export function CategoryGroupFilter({
  value,
  onChange,
  // One-shot pulse/glow ring around the whole row — set by WorkplaceBrowser
  // when a footer link (e.g. "Job Categories") routes here specifically to
  // point at these buttons. See globals.css's .highlight-pulse.
  highlighted = false,
}: {
  value: CategoryGroup | null;
  onChange: (next: CategoryGroup | null) => void;
  highlighted?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Filter by category group"
      className={`flex flex-wrap items-center gap-2 rounded-full ${highlighted ? "highlight-pulse" : ""}`}
    >
      {CATEGORY_GROUP_BUTTONS.map((opt) => {
        const checked = value === opt.value;
        const Icon = opt.icon;
        return (
          <div key={opt.value} className="group relative flex">
            <button
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={opt.label}
              onClick={() => onChange(checked ? null : opt.value)}
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
                checked
                  ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                  : "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
              }`}
            >
              <Icon className="h-5 w-5" />
            </button>
            {/* Custom tooltip instead of the native `title` — shows
                instantly on hover/keyboard focus rather than after
                the browser's built-in delay, and matches the
                site's own type/theme instead of the OS default.
                Gone entirely once this option is picked — the
                selected outline already says which one it is. */}
            {!checked && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {opt.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
