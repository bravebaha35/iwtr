"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { scoreBandLabel, type CompanyListItem, type WorkplaceType } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { scoreTextColor } from "@/lib/scoreBandColors";
import { WORKPLACE_TYPES, workplaceTypeLabel } from "@/lib/workplaceTypes";
import { collarPillClassName } from "@/lib/collarColors";
import { sectorsForWorkplaceTypes } from "@/lib/sectors";
import { MultiFilterPillGroup } from "@/components/FilterPillGroup";
import { RewindButton } from "@/components/RewindButton";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CityDistrictPicker } from "@/components/CityDistrictPicker";
import { AdSlot } from "@/components/AdSlot";
import { distanceKm, findProvinceByCityName } from "@/lib/turkeyGeo";

type Geo = { lat: number; lng: number } | "denied" | null;

// Placeholder emojis for the 0/2.5/5 rating-slider ticks — swap for real
// icons once they're picked.
const RATING_TICKS: { value: number; emoji: string }[] = [
  { value: 0, emoji: "😠" },
  { value: 2.5, emoji: "😐" },
  { value: 5, emoji: "😄" },
];

type SortOption = "default" | "alphabetical" | "rating" | "workplace";
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "alphabetical", label: "A-Z" },
  { value: "rating", label: "Rating" },
  { value: "workplace", label: "Workplace" },
];

const RESULTS_PAGE_SIZE = 24;

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

function CompanyCard({ company }: { company: CompanyListItem }) {
  return (
    <Link
      href={`/companies/${company.slug}`}
      className="flex items-center gap-3 compact:gap-2 rounded-xl border border-border bg-surface p-4 compact:p-2.5 transition hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700"
    >
      <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground compact:text-sm">{company.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {company.workplaceTypes.map(workplaceTypeLabel).join(" / ")} · {company.category}
          {company.city ? ` · ${company.city}` : ""}
          {company.district ? `, ${company.district}` : ""}
        </p>
      </div>

      {company.overallAvg !== null ? (
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-lg compact:text-base font-bold text-foreground">
            {company.overallAvg.toFixed(1)}
          </span>
          <span className={`text-xs font-medium ${scoreTextColor(company.overallAvg)}`}>
            {scoreBandLabel(company.overallAvg)}
          </span>
          <span className="text-xs text-muted-foreground compact:hidden">
            ({company.reviewCount} review{company.reviewCount === 1 ? "" : "s"})
          </span>
        </div>
      ) : (
        <p className="shrink-0 text-xs text-muted-foreground">No reviews yet</p>
      )}
    </Link>
  );
}

function distanceOf(company: CompanyListItem, geo: { lat: number; lng: number }): number {
  const province = findProvinceByCityName(company.city);
  if (!province) return Infinity;
  return distanceKm(geo.lat, geo.lng, province.lat, province.lng);
}

export function WorkplaceBrowser() {
  const [workplaceTypes, setWorkplaceTypes] = useState<WorkplaceType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedDistrictKeys, setSelectedDistrictKeys] = useState<string[]>([]);
  const [query, setQuery] = useState("");
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
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const resultsTopRef = useRef<HTMLDivElement>(null);

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

    if (sortBy === "alphabetical") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "rating") {
      list = [...list].sort((a, b) => (b.overallAvg ?? -1) - (a.overallAvg ?? -1));
    } else if (sortBy === "workplace") {
      // Sorts by each company's first (primary) tag only — not a full
      // multi-key sort — since a company can carry up to 2 workplaceTypes.
      const order = WORKPLACE_TYPES.map((t) => t.value);
      list = [...list].sort((a, b) => order.indexOf(a.workplaceTypes[0]) - order.indexOf(b.workplaceTypes[0]));
    } else if (geo && geo !== "denied") {
      list = [...list].sort((a, b) => distanceOf(a, geo) - distanceOf(b, geo));
    }
    return list;
  }, [companies, selectedCategory, geo, sortBy]);

  // Any change to what's being shown should land back on page 1 — otherwise
  // narrowing a filter can strand you on a now-nonexistent page 12 of 2.
  useEffect(() => {
    setPage(1);
  }, [workplaceTypes, selectedCategory, minRating, selectedCities, selectedDistrictKeys, sortBy, query]);

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
                pillColorClassName={collarPillClassName}
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
                  toward the worst-rated end. Emojis at 0/2.5/5 are
                  placeholders — swap for real artwork later. Click-and-drag
                  on the track (or scroll) sets the value; avoids a native
                  <input type="range">, which never fully themes across
                  browsers and can't take a gradient track everywhere.
                  Each tick's horizontal translate is edge-aware — centering
                  every emoji (-translate-x-1/2) would push the leftmost one
                  half outside the box on the left and the rightmost one half
                  outside on the right, so the two ends anchor inward instead
                  and only the middle tick stays centered. */}
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-3 py-3 select-none overflow-hidden">
                <div className="relative pt-7">
                  {RATING_TICKS.map((tick) => (
                    <span
                      key={tick.value}
                      className={`absolute top-0 text-lg leading-none ${
                        tick.value === 0 ? "translate-x-0" : tick.value === 5 ? "-translate-x-full" : "-translate-x-1/2"
                      }`}
                      style={{ left: `${(tick.value / 5) * 100}%` }}
                    >
                      {tick.emoji}
                    </span>
                  ))}

                  <div
                    ref={sliderTrackRef}
                    onPointerDown={handleSliderPointerDown}
                    onPointerMove={handleSliderPointerMove}
                    className="relative h-2 w-full cursor-pointer touch-none rounded-full"
                    style={{ background: "linear-gradient(to right, #ef4444, #22c55e)" }}
                    title="Click and drag along the slider, or scroll, to fine-tune"
                  >
                    {RATING_TICKS.map((tick) => (
                      <span
                        key={tick.value}
                        className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-white/70"
                        style={{ left: `${(tick.value / 5) * 100}%` }}
                      />
                    ))}
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
            <div className="mb-4 flex items-center gap-2">
              <input
                type="search"
                placeholder="Search a workplace by name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full max-w-sm rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground"
              />
              <div className="relative ml-auto">
                <button
                  type="button"
                  onClick={() => setSortMenuOpen((o) => !o)}
                  aria-label="Sort"
                  title="Sort"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground hover:bg-surface-muted"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M6 12h12M10 18h4" />
                  </svg>
                </button>
                {sortMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[65]" onClick={() => setSortMenuOpen(false)} />
                    <div className="absolute right-full top-0 z-[70] mr-2 w-40 rounded-lg border border-border bg-surface py-1 shadow-lg">
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setSortBy(opt.value);
                            setSortMenuOpen(false);
                          }}
                          className={`block w-full px-3 py-2 text-left text-sm ${
                            sortBy === opt.value
                              ? "font-semibold text-brand-600 dark:text-brand-400"
                              : "text-foreground hover:bg-surface-muted"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
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
            <div className="grid grid-cols-1 gap-4 compact:gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 compact:lg:grid-cols-4 compact:xl:grid-cols-5">
              {pageCompanies?.map((c) => (
                <CompanyCard key={c.id} company={c} />
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
