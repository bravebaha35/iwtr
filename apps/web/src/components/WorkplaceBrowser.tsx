"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { scoreBandLabel, type CompanyListItem, type WorkplaceType } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { scoreTextColor } from "@/lib/scoreBandColors";
import { WORKPLACE_TYPES, workplaceTypeLabel } from "@/lib/workplaceTypes";
import { collarSegmentClassName } from "@/lib/collarColors";
import { sectorsForWorkplaceTypes } from "@/lib/sectors";
import { type CategoryGroup, matchesCategoryGroup, CategoryGroupFilter } from "@/lib/categoryGroups";
import { MultiFilterPillGroup } from "@/components/FilterPillGroup";
import { RewindButton } from "@/components/RewindButton";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { CityDistrictPicker } from "@/components/CityDistrictPicker";
import { AdSlot } from "@/components/AdSlot";
import { CompanyWorkCard } from "@/components/company/CompanyWorkCard";
import { distanceKm, findProvinceByCityName } from "@/lib/turkeyGeo";

type Geo = { lat: number; lng: number } | "denied" | null;

// Custom mood art for the 0/2.5/5 rating-slider ticks (apps/web/public),
// replacing the placeholder emojis.
const RATING_TICKS: { value: number; src: string; alt: string }[] = [
  { value: 0, src: "/1LowMood.png", alt: "Low rating" },
  { value: 2.5, src: "/3MidMood.png", alt: "Mid rating" },
  { value: 5, src: "/5HighMood.png", alt: "High rating" },
];

// Which of the 3 mood mascots is "live" for the current slider value — an
// even 3-way split of the 0-5 range (not tied to the ticks' exact anchor
// values), so the red mascot owns the left third of the track, the middle
// one the middle third, and the green one the right third.
function activeMoodIndex(value: number): number {
  if (value < 5 / 3) return 0;
  if (value < 10 / 3) return 1;
  return 2;
}

// "ratingAsc"/"ratingDesc" are two separate states (not one "rating" value
// the Rating button just flips) because the button cycles through three
// distinct looks — neutral, red-outlined (worst first), green-outlined
// (best first) — and each needs its own stored state to read back on
// re-render.
type SortOption = "default" | "alphabetical" | "workplace" | "ratingAsc" | "ratingDesc";

// 4 columns × 5 rows at the desktop breakpoint — see CompanyCard/grid below.
const RESULTS_PAGE_SIZE = 20;

// Google-style page list: always show the first and last page, a small
// window around the current page, and "…" for whatever's skipped in between.
function pageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

function PaginationBar({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-10 flex items-center justify-center gap-1 text-sm" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="Previous page"
        className="rounded-lg px-2.5 py-1.5 text-muted-foreground transition hover:bg-surface-muted disabled:opacity-30"
      >
        ‹
      </button>
      {pageNumbers(page, totalPages).map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`min-w-9 rounded-lg px-2.5 py-1.5 font-medium transition ${
              p === page ? "bg-brand-600 text-white" : "text-foreground hover:bg-surface-muted"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        aria-label="Next page"
        className="rounded-lg px-2.5 py-1.5 text-muted-foreground transition hover:bg-surface-muted disabled:opacity-30"
      >
        ›
      </button>
    </nav>
  );
}

function distanceOf(company: CompanyListItem, geo: { lat: number; lng: number }): number {
  const province = findProvinceByCityName(company.city);
  if (!province) return Infinity;
  return distanceKm(geo.lat, geo.lng, province.lat, province.lng);
}

type HighlightTarget = "search" | "categories";

// Reads GlobalFooter.tsx's `?highlight=search|categories` (added to
// "Submit a Review"/"Claim Profile" and "Job Categories" respectively) so
// arriving here can point at the right control instead of a bare
// navigation with no explanation. useSearchParams (not a one-time
// window.location read) so this still fires on a query-only client-side
// navigation that doesn't remount WorkplaceBrowser — e.g. clicking the
// footer link while already on the homepage. Split into its own component
// only because useSearchParams requires a Suspense boundary for the build;
// fallback is null since this renders nothing itself.
// Persists every filter/search/sort/page choice across a visit to a company
// page and back (BackButton.tsx's router.back(), or the header logo — both
// land back on "/", and the App Router fully remounts this client component
// on that navigation rather than restoring its previous instance, so plain
// useState alone loses everything). sessionStorage rather than the URL: this
// app deliberately keeps homepage URLs bare (see HighlightParamListener's
// own one-shot ?highlight= param), and sessionStorage already matches the
// right lifetime — remembered for the rest of this browsing session, gone
// once the tab closes, never a stale filter resurrected days later.
// Deliberately excludes `geo`: reusing a stored device position without a
// fresh "Near Me" click would silently reintroduce the exact behavior the
// geo state's own comment above rules out.
const FILTER_STORAGE_KEY = "iwtr:homeFilters";

interface PersistedFilters {
  workplaceTypes: WorkplaceType[];
  selectedCategory: string | null;
  minRating: number;
  selectedCities: string[];
  selectedDistrictKeys: string[];
  query: string;
  sortBy: SortOption;
  categoryGroup: CategoryGroup | null;
  page: number;
}

function loadPersistedFilters(): Partial<PersistedFilters> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(FILTER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function HighlightParamListener({ onHighlight }: { onHighlight: (target: HighlightTarget) => void }) {
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");

  useEffect(() => {
    if (highlight !== "search" && highlight !== "categories") return;
    onHighlight(highlight);
    // Strip the param so the URL doesn't linger with ?highlight=... and
    // re-trigger the pulse on every later refresh of the same page.
    const url = new URL(window.location.href);
    url.searchParams.delete("highlight");
    window.history.replaceState({}, "", url.toString());
  }, [highlight, onHighlight]);

  return null;
}

export function WorkplaceBrowser() {
  // Set briefly by HighlightParamListener above to pulse/glow whichever
  // control a footer link pointed at, then cleared once the CSS animation
  // (.highlight-pulse, 3 iterations of a 0.8s keyframe ≈ 2.4s) has finished.
  const [highlightTarget, setHighlightTarget] = useState<HighlightTarget | null>(null);
  const onHighlight = useCallback((target: HighlightTarget) => {
    setHighlightTarget(target);
    window.setTimeout(() => setHighlightTarget(null), 2500);
  }, []);

  // Read once on mount (the setter is never called) — see loadPersistedFilters
  // above for why this exists at all.
  const [initialFilters] = useState(loadPersistedFilters);

  const [workplaceTypes, setWorkplaceTypes] = useState<WorkplaceType[]>(() =>
    Array.isArray(initialFilters.workplaceTypes) ? initialFilters.workplaceTypes : [],
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() => initialFilters.selectedCategory ?? null);
  const [minRating, setMinRating] = useState(() => (typeof initialFilters.minRating === "number" ? initialFilters.minRating : 0));
  const [selectedCities, setSelectedCities] = useState<string[]>(() =>
    Array.isArray(initialFilters.selectedCities) ? initialFilters.selectedCities : [],
  );
  const [selectedDistrictKeys, setSelectedDistrictKeys] = useState<string[]>(() =>
    Array.isArray(initialFilters.selectedDistrictKeys) ? initialFilters.selectedDistrictKeys : [],
  );
  const [query, setQuery] = useState(() => initialFilters.query ?? "");
  const [companies, setCompanies] = useState<CompanyListItem[] | null>(null);
  // Distinguishes "the request failed" from "genuinely zero matches" — both
  // used to collapse into the same empty `companies` state and render the
  // same "No workplaces match these filters yet" message, which made a
  // backend/network outage indistinguishable from a real empty result.
  const [loadError, setLoadError] = useState(false);
  // null = never asked (the resting/default state — "All" stays "All" until
  // the visitor deliberately clicks "Near Me"). Geolocation is NEVER
  // requested automatically and NEVER falls back to the visitor's own
  // profile city — both used to happen silently on page load, which quietly
  // narrowed "All" down to their onboarding city with no action from them.
  const [geo, setGeo] = useState<Geo>(null);
  const [geoRequesting, setGeoRequesting] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>(() => initialFilters.sortBy ?? "default");
  const [categoryGroup, setCategoryGroup] = useState<CategoryGroup | null>(() => initialFilters.categoryGroup ?? null);
  const [page, setPage] = useState(() => (typeof initialFilters.page === "number" ? initialFilters.page : 1));
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const resultsTopRef = useRef<HTMLDivElement>(null);
  // The two "reset on filter change" effects below (category-reset,
  // page-reset) would otherwise fire on this very first render too — since
  // effect dependency arrays trigger once on mount regardless — and wipe out
  // the selectedCategory/page values just restored from sessionStorage above.
  const skipCategoryResetOnce = useRef(true);
  const skipPageResetOnce = useRef(true);

  function stepRating(delta: number) {
    setMinRating((prev) => Math.min(5, Math.max(0, Math.round((prev + delta) * 10) / 10)));
  }

  // React registers the root `wheel` listener as passive, so `preventDefault`
  // inside a React onWheel prop is silently ignored and the page scrolls
  // underneath instead of the rating changing. Attaching the listener
  // natively with passive:false is the only way to actually block the scroll.
  useEffect(() => {
    const el = sliderTrackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stepRating(e.deltaY < 0 ? 0.1 : -0.1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Press-and-hold scrub: mouse position across the track maps directly to a
  // 0-5 value, so a single click sets a point and holding + dragging sweeps
  // through every 0.1 step in between. Uses Pointer Capture rather than
  // window-level mousemove/mouseup listeners: capturing the pointer on the
  // track guarantees onPointerMove/Up keep firing on this element even if the
  // cursor leaves it (or the button is released outside the browser window
  // entirely). A window-listener version can't detect a release outside the
  // window, leaking a permanent mousemove listener that fires setMinRating on
  // every future mouse move anywhere on the page — which starves re-renders
  // and makes unrelated clicks (e.g. Cities & Districts) look "disabled".
  // Maps cursor position directly onto the 0-5 range every time — the thumb
  // is drawn at `(minRating / 5) * 100%` (see below), so this is the only
  // formula that keeps the thumb glued exactly under the cursor. An earlier
  // version damped pointermove by scaling the drag *delta*, which felt
  // smoother but desynced the thumb from the actual cursor position the
  // moment you started dragging — don't reintroduce delta-based tracking here.
  function applyRatingFromClientX(el: HTMLDivElement, clientX: number) {
    const rect = el.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const value = Math.round(fraction * 5 * 10) / 10;
    setMinRating(value);
    return value;
  }

  function handleSliderPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    applyRatingFromClientX(e.currentTarget, e.clientX);
  }

  function handleSliderPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
    applyRatingFromClientX(e.currentTarget, e.clientX);
  }

  // "Near Me" button only: geolocation is never requested until the visitor
  // clicks it, and success only ever reorders results by proximity — it
  // never touches selectedCities/selectedDistrictKeys, so "All" stays "All".
  function requestNearMe() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeo("denied");
      return;
    }
    setGeoRequesting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoRequesting(false);
      },
      () => {
        setGeo("denied");
        setGeoRequesting(false);
      },
      { timeout: 8000 },
    );
  }

  // Sends everything except `category` to the server — q, workplaceTypes,
  // cities/districtKeys, and minRating are real Prisma WHERE clauses now
  // (see CompaniesService.search), rather than fetching the whole directory
  // and filtering it in the browser. `category` stays client-side (applied
  // in visibleCompanies below) for one reason: the category dropdown's own
  // option list needs to reflect what's available for the current
  // workplaceTypes selection regardless of which category happens to be
  // picked — filtering it server-side too would make picking a category
  // collapse the dropdown down to just that one option. Debounced 250ms so
  // dragging the rating slider or toggling several pills in a row doesn't
  // fire a request per intermediate value.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (workplaceTypes.length > 0) params.set("workplaceTypes", workplaceTypes.join(","));
    if (selectedCities.length > 0) params.set("cities", selectedCities.join(","));
    if (selectedDistrictKeys.length > 0) params.set("districtKeys", selectedDistrictKeys.join(","));
    if (minRating > 0) params.set("minRating", String(minRating));

    let cancelled = false;
    setLoadError(false);
    const handle = setTimeout(() => {
      apiGet<CompanyListItem[]>(`/companies?${params.toString()}`)
        .then((data) => {
          if (!cancelled) setCompanies(data);
        })
        .catch(() => {
          if (!cancelled) {
            setCompanies([]);
            setLoadError(true);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, workplaceTypes, selectedCities, selectedDistrictKeys, minRating]);

  // Changing which workplace type(s) are active can make the current
  // category selection unavailable (or just irrelevant) — reset it rather
  // than silently filtering against a category the visible dropdown no
  // longer offers.
  useEffect(() => {
    if (skipCategoryResetOnce.current) {
      skipCategoryResetOnce.current = false;
      return;
    }
    setSelectedCategory(null);
  }, [workplaceTypes]);

  // Narrows the Sector dropdown to whichever sectors are tagged with at
  // least one of the currently selected workplace type(s) (see sectors.ts)
  // — e.g. selecting "Office" hides purely-manual sectors like
  // "Construction" but keeps "Healthcare" (tagged Office + Service). With no
  // workplace type selected ("All"), every sector is shown.
  const sectorOptions = useMemo(() => sectorsForWorkplaceTypes(workplaceTypes), [workplaceTypes]);

  const visibleCompanies = useMemo(() => {
    if (!companies) return null;
    let list = selectedCategory ? companies.filter((c) => c.category === selectedCategory) : companies;
    list = list.filter((c) => matchesCategoryGroup(c, categoryGroup));

    if (sortBy === "alphabetical") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "ratingDesc") {
      list = [...list].sort((a, b) => (b.overallAvg ?? -1) - (a.overallAvg ?? -1));
    } else if (sortBy === "ratingAsc") {
      // Unrated companies (no overallAvg) fall back to +Infinity on both
      // sides here, same as the -1 fallback above for the descending case
      // — either way they sink to the bottom instead of contaminating the
      // "least rated" or "best rated" end of the list.
      list = [...list].sort((a, b) => (a.overallAvg ?? Infinity) - (b.overallAvg ?? Infinity));
    } else if (sortBy === "workplace") {
      // Sorts by each company's first (primary) tag only — not a full
      // multi-key sort — since a company can carry up to 2 workplaceTypes.
      const order = WORKPLACE_TYPES.map((t) => t.value);
      list = [...list].sort((a, b) => order.indexOf(a.workplaceTypes[0]) - order.indexOf(b.workplaceTypes[0]));
    } else if (geo && geo !== "denied") {
      list = [...list].sort((a, b) => distanceOf(a, geo) - distanceOf(b, geo));
    }
    return list;
  }, [companies, selectedCategory, categoryGroup, geo, sortBy]);

  // Any change to what's being shown should land back on page 1 — otherwise
  // narrowing a filter can strand you on a now-nonexistent page 12 of 2.
  useEffect(() => {
    if (skipPageResetOnce.current) {
      skipPageResetOnce.current = false;
      return;
    }
    setPage(1);
  }, [workplaceTypes, selectedCategory, minRating, selectedCities, selectedDistrictKeys, sortBy, query]);

  // Mirror every filter/search/sort/page choice into sessionStorage as it
  // changes, so loadPersistedFilters picks it back up on the next mount (see
  // that function's comment for why this exists).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const toStore: PersistedFilters = {
      workplaceTypes,
      selectedCategory,
      minRating,
      selectedCities,
      selectedDistrictKeys,
      query,
      sortBy,
      categoryGroup,
      page,
    };
    try {
      window.sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // Storage can throw under private-browsing/storage-restricted settings —
      // remembering filters is a nice-to-have, never required for the page to work.
    }
  }, [workplaceTypes, selectedCategory, minRating, selectedCities, selectedDistrictKeys, query, sortBy, categoryGroup, page]);

  const totalPages = visibleCompanies ? Math.max(1, Math.ceil(visibleCompanies.length / RESULTS_PAGE_SIZE)) : 1;
  const pageCompanies = visibleCompanies?.slice((page - 1) * RESULTS_PAGE_SIZE, page * RESULTS_PAGE_SIZE) ?? null;

  function goToPage(next: number) {
    setPage(next);
    resultsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Mirrors the "a company can carry at most 2 workplaceTypes" rule (see
  // CLAUDE.md) on the filter side too: picking a 3rd, distinct type doesn't
  // add to the selection — it starts a fresh selection with just that type,
  // as if the two previous picks were cleared first.
  function toggleWorkplaceType(value: WorkplaceType) {
    setWorkplaceTypes((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (prev.length >= 2) return [value];
      return [...prev, value];
    });
  }

  // Clears back to no workplace-type filter — which, since the server only
  // filters by workplaceTypes when the list is non-empty, is the same thing
  // as "show every workplace type".
  function resetWorkplaceTypes() {
    setWorkplaceTypes([]);
  }

  // Single-select: picking a different city replaces whichever one was
  // chosen before, rather than adding to a set of cities.
  function toggleCity(city: string) {
    setSelectedCities((prev) => (prev.includes(city) ? [] : [city]));
  }

  function toggleDistrict(key: string) {
    setSelectedDistrictKeys((prev) => (prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]));
  }

  function resetLocation() {
    setSelectedCities([]);
    setSelectedDistrictKeys([]);
  }

  return (
    <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
      <AdSlot />

      <div className="w-full max-w-[1600px]">
        <div className="flex flex-col gap-6 sm:flex-row">
          <aside className="flex shrink-0 flex-col gap-6 sm:w-56">
            <div>
              <MultiFilterPillGroup
                heading="Work-Type"
                options={WORKPLACE_TYPES}
                selected={workplaceTypes}
                onToggle={toggleWorkplaceType}
                onReset={resetWorkplaceTypes}
                direction="grid"
                variant="track"
                pillColorClassName={collarSegmentClassName}
              />
              <div className="mt-2">
                <SingleSelectDropdown
                  value={selectedCategory}
                  options={sectorOptions}
                  placeholder="Sector"
                  onChange={setSelectedCategory}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rating</h3>
                <RewindButton onClick={() => setMinRating(0)} active={minRating !== 0} title="Reset rating filter" />
              </div>
              {/* Red-to-green slider, no stars. Shows companies at or BELOW
                  the chosen value (not "X and up"), so dragging left tightens
                  toward the worst-rated end. Click-and-drag on the track (or
                  scroll) sets the value; avoids a native <input type="range">,
                  which never fully themes across browsers and can't take a
                  gradient track everywhere. Each tick's horizontal translate
                  is edge-aware — centering every icon (-translate-x-1/2)
                  would push the leftmost one half outside the box on the
                  left and the rightmost one half outside on the right, so
                  the two ends nudge outward past the track by 10px instead
                  (no overflow-hidden on the wrapper, so this is visible) and
                  only the middle tick stays centered. Only the mascot for the slider's
                  current third is at full size/color (scale-110, no filter)
                  — the other two sit dim and grayscale (scale-90, opacity-40)
                  until the value slides into their zone. */}
              <div className="flex flex-col gap-3 rounded-lg px-3 py-3 select-none">
                <div className="relative pt-16">
                  {RATING_TICKS.map((tick, i) => {
                    const active = activeMoodIndex(minRating) === i;
                    return (
                      // eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size static mood art
                      <img
                        key={tick.value}
                        src={tick.src}
                        alt={tick.alt}
                        className={`absolute top-0 h-14 w-14 transition-all duration-200 ${
                          tick.value === 0
                            ? "translate-x-[-10px]"
                            : tick.value === 5
                              ? "translate-x-[calc(-100%+10px)]"
                              : "-translate-x-1/2"
                        } ${active ? "scale-110 opacity-100" : "scale-90 opacity-40 grayscale"}`}
                        style={{ left: `${(tick.value / 5) * 100}%` }}
                      />
                    );
                  })}

                  <div
                    ref={sliderTrackRef}
                    onPointerDown={handleSliderPointerDown}
                    onPointerMove={handleSliderPointerMove}
                    className="relative h-2 w-full cursor-pointer touch-none rounded-full"
                    style={{ background: "linear-gradient(to right, #ef4444, #22c55e)" }}
                    title="Click and drag along the slider, or scroll, to fine-tune"
                  >
                    <span
                      className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-foreground shadow"
                      style={{ left: `${(minRating / 5) * 100}%` }}
                    />
                  </div>
                </div>

                <span className="text-center text-xs font-normal text-muted-foreground">
                  {minRating === 0 || minRating === 5 ? "Any" : `${minRating.toFixed(1)} and Below`}
                </span>
              </div>
            </div>

            <CityDistrictPicker
              selectedCities={selectedCities}
              selectedDistrictKeys={selectedDistrictKeys}
              onToggleCity={toggleCity}
              onToggleDistrict={toggleDistrict}
              onReset={resetLocation}
              onNearMe={requestNearMe}
              nearMeLoading={geoRequesting}
              nearMeActive={geo !== null && geo !== "denied"}
            />
          </aside>

          {/* Results */}
          <div ref={resultsTopRef} className="flex-1">
            <Suspense fallback={null}>
              <HighlightParamListener onHighlight={onHighlight} />
            </Suspense>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                type="search"
                placeholder="Search a workplace by name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`w-full max-w-sm rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground ${
                  highlightTarget === "search" ? "highlight-pulse" : ""
                }`}
              />

              {/* Curated category-group quick filter — a coarser,
                  single-select alternative to the free-text Sector dropdown
                  above, for the 4 groupings that matter most on the browse
                  page. Sits between the search box and the sort buttons. */}
              <CategoryGroupFilter
                value={categoryGroup}
                onChange={setCategoryGroup}
                highlighted={highlightTarget === "categories"}
              />

              {/* Standalone toggle buttons instead of a "Sort by" dropdown —
                  every option is visible and clickable directly. A-Z and
                  Workplace are plain on/off toggles (click again to go
                  back to the default order); Rating instead cycles
                  through three states on each click — neutral, red
                  outline (least-rated first), green outline (best-rated
                  first), then back to neutral. */}
              <div className="ml-auto flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800/60 dark:bg-zinc-950/80">
                <button
                  type="button"
                  onClick={() => setSortBy((s) => (s === "alphabetical" ? "default" : "alphabetical"))}
                  aria-pressed={sortBy === "alphabetical"}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    sortBy === "alphabetical"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  A-Z
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy((s) => (s === "workplace" ? "default" : "workplace"))}
                  aria-pressed={sortBy === "workplace"}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    sortBy === "workplace"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  Workplace
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSortBy((s) => (s === "ratingAsc" ? "ratingDesc" : s === "ratingDesc" ? "default" : "ratingAsc"))
                  }
                  aria-pressed={sortBy === "ratingAsc" || sortBy === "ratingDesc"}
                  title={
                    sortBy === "ratingAsc"
                      ? "Showing least-rated first"
                      : sortBy === "ratingDesc"
                        ? "Showing best-rated first"
                        : "Sort by rating"
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    sortBy === "ratingAsc"
                      ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-400"
                      : sortBy === "ratingDesc"
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  Rating
                </button>
              </div>
            </div>

            {geo && geo !== "denied" && (
              <p className="mb-3 text-xs text-muted-foreground">Showing workplaces nearest to you first.</p>
            )}
            {geo === "denied" && (
              <p className="mb-3 text-xs text-muted-foreground">
                Couldn&apos;t get your location — showing all workplaces.
              </p>
            )}

            {pageCompanies === null && <p className="text-sm text-muted-foreground">Loading...</p>}
            {pageCompanies !== null && pageCompanies.length === 0 && loadError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Couldn&apos;t load workplaces right now — check your connection and try again.
              </p>
            )}
            {pageCompanies !== null && pageCompanies.length === 0 && !loadError && (
              <p className="text-sm text-muted-foreground">No workplaces match these filters yet.</p>
            )}
            {/* Fixed at 4 columns from the xl breakpoint up (never 5, even in
                compact density) — 20 per page lays out as a clean 4x5 grid,
                trading the extra column for taller cards that show the full
                company name instead of truncating it. */}
            <div className="grid grid-cols-1 gap-4 compact:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pageCompanies?.map((c) => (
                <CompanyWorkCard key={c.id} company={c} href={`/companies/${c.slug}`} />
              ))}
            </div>

            {visibleCompanies !== null && visibleCompanies.length > 0 && (
              <>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Page {page} of {totalPages} — {visibleCompanies.length} workplace
                  {visibleCompanies.length === 1 ? "" : "s"}
                </p>
                <PaginationBar page={page} totalPages={totalPages} onChange={goToPage} />
              </>
            )}
          </div>
        </div>
      </div>

      <AdSlot />
    </div>
  );
}
