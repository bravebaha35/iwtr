"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type SortOption } from "@/components/SortButtons";
import { SearchSortBox } from "@/components/SearchSortBox";
import Image from "next/image";
import { JOBS_BROWSE_PAGE_SIZE, type CompanyBrowseResult, type MyProfile, type WorkplaceType } from "@iwtr/shared-types";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";
import { apiGet } from "@/lib/api-client";
import { fetchBrowsePage, hasBrowsePage, prefetchBrowsePage } from "@/lib/companyBrowse";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";
import { collarOutlinedButtonClassName } from "@/lib/collarColors";
import { sectorsForWorkplaceTypes } from "@/lib/sectors";
import { type CategoryGroup, CategoryGroupFilter } from "@/lib/categoryGroups";
import { MultiFilterPillGroup } from "@/components/FilterPillGroup";
import { RewindButton } from "@/components/RewindButton";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { CityDistrictPicker } from "@/components/CityDistrictPicker";
import { JobCard, postingsForCard } from "@/components/jobs/JobCard";
import { JobCreationFlow } from "@/components/jobs/JobCreationFlow";
import { distanceKm, TURKEY_PROVINCES } from "@/lib/turkeyGeo";
import { useFollowedCompanies } from "@/lib/useFollowedCompanies";
import { useSavedJobPostings } from "@/lib/useSavedJobPostings";
import { BookmarkIcon } from "@/components/jobs/BookmarkIcon";
import { RiskScoreFilter } from "@/components/jobs/RiskScoreFilter";
import { SidebarShell, SidebarContentRow } from "@/components/layout/SidebarShell";

// This whole file is a deliberate near-duplicate of WorkplaceBrowser.tsx
// rather than a shared-internals refactor of it — the brief asked for the
// main rating homepage to stay entirely untouched, and this page's own
// filter/sort/search behavior needs to keep evolving independently of it
// (e.g. it always sends includeJobTitles and only ever shows isHiring
// companies). Same reasoning the codebase already uses elsewhere for two
// small, stable, independently-evolving copies of one thing (see
// classifyJobRole.ts's matchesAsWord/foldTr comment) rather than an
// extraction that isn't worth it yet.

// "Near Me" keeps only the nearest province's name - the visitor's actual
// position never leaves requestNearMe, let alone the browser.
type Geo = { nearCity: string } | "denied" | null;

// The filter the page put on by itself from the member's profile (see the
// personalising effect in JobsBrowser), so the note above the cards can say
// what was applied and offer to clear it.
type AutoFilter = { kind: "sector"; value: string; label: string } | { kind: "workType"; value: WorkplaceType; label: string };

const RATING_TICKS: { value: number; src: string; alt: string }[] = [
  { value: 0, src: "/1LowMood.png", alt: "Low rating" },
  { value: 2.5, src: "/3MidMood.png", alt: "Mid rating" },
  { value: 5, src: "/5HighMood.png", alt: "High rating" },
];

// Which of the 3 mood mascots is "live" for the current slider value — an
// even 3-way split of the 0-5 range (not tied to the ticks' exact anchor
// values), so the red mascot owns the left third of the track, the middle
// one the middle third, and the green one the right third. Kept as a
// separate copy of WorkplaceBrowser.tsx's identical helper per this file's
// standing near-duplicate policy (see the file-header comment).
function activeMoodIndex(value: number): number {
  if (value < 5 / 3) return 0;
  if (value < 10 / 3) return 1;
  return 2;
}


// 4 columns × 4 rows at the desktop breakpoint, matching the homepage's own
// "columns × rows" page-size convention (see WorkplaceBrowser.tsx).
const RESULTS_PAGE_SIZE = JOBS_BROWSE_PAGE_SIZE;

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


function nearestProvince(lat: number, lng: number): string {
  let best = TURKEY_PROVINCES[0];
  for (const p of TURKEY_PROVINCES) {
    if (distanceKm(lat, lng, p.lat, p.lng) < distanceKm(lat, lng, best.lat, best.lng)) best = p;
  }
  return best.name;
}

/** The query string GET /companies/browse gets for the Jobs page, without a page number. */
function jobsParams(f: {
  query: string;
  workplaceTypes: WorkplaceType[];
  selectedCities: string[];
  selectedDistrictKeys: string[];
  minRating: number;
  maxRiskScore: number;
  selectedCategory: string | null;
  categoryGroup: CategoryGroup | null;
  sortBy: SortOption;
  geo: Geo;
  selectedCompanyId: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("jobs", "1");
  if (f.query.trim()) params.set("q", f.query.trim());
  if (f.workplaceTypes.length > 0) params.set("workplaceTypes", f.workplaceTypes.join(","));
  if (f.selectedCities.length > 0) params.set("cities", f.selectedCities.join(","));
  if (f.selectedDistrictKeys.length > 0) params.set("districtKeys", f.selectedDistrictKeys.join(","));
  if (f.minRating > 0) params.set("minRating", String(f.minRating));
  if (f.maxRiskScore < 3) params.set("maxRiskScore", String(f.maxRiskScore));
  if (f.selectedCategory) params.set("category", f.selectedCategory);
  if (f.categoryGroup) params.set("categoryGroup", f.categoryGroup);
  if (f.sortBy !== "default") params.set("sort", f.sortBy);
  if (f.geo && f.geo !== "denied") params.set("nearCity", f.geo.nearCity);
  if (f.selectedCompanyId) params.set("companyId", f.selectedCompanyId);
  return params.toString();
}

const NO_FILTERS = {
  query: "",
  workplaceTypes: [] as WorkplaceType[],
  selectedCities: [] as string[],
  selectedDistrictKeys: [] as string[],
  minRating: 0,
  maxRiskScore: 3,
  selectedCategory: null,
  categoryGroup: null,
  sortBy: "default" as SortOption,
  geo: null,
  selectedCompanyId: null,
};

// Same data source as SocialSidebar's FollowingList (useFollowedCompanies),
// but a single-select CLIENT-SIDE FILTER instead of navigation — clicking a
// name narrows the results grid to that one company; clicking the same name
// again clears the filter and restores the unfiltered view. Not shared with
// SocialSidebar's version since the click behavior is genuinely different,
// matching this file's own standing near-duplicate policy (see the
// file-header comment above).
function FollowingFilterList({
  selectedCompanyId,
  onSelect,
}: {
  selectedCompanyId: string | null;
  onSelect: (companyId: string | null) => void;
}) {
  const { companies, loading } = useFollowedCompanies();

  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Following</h2>
      <div className="flex h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1.5">
        {loading && <p className="p-1.5 text-xs text-muted-foreground">Loading...</p>}
        {!loading && companies.length === 0 && (
          <p className="p-1.5 text-xs text-muted-foreground">You&apos;re not following any companies yet.</p>
        )}
        {companies.map((c) => (
          <button
            key={c.companyId}
            type="button"
            onClick={() => onSelect(selectedCompanyId === c.companyId ? null : c.companyId)}
            aria-pressed={selectedCompanyId === c.companyId}
            className={`truncate rounded-md px-1.5 py-1 text-left text-sm transition ${
              selectedCompanyId === c.companyId
                ? "bg-brand-600 font-semibold text-white"
                : "text-foreground hover:bg-surface-muted"
            }`}
          >
            {c.companyName}
          </button>
        ))}
      </div>
    </div>
  );
}

export function JobsBrowser() {
  const isCompanyOwner = useIsCompanyOwner();
  const [jobFlowOpen, setJobFlowOpen] = useState(false);
  const [workplaceTypes, setWorkplaceTypes] = useState<WorkplaceType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryGroup, setCategoryGroup] = useState<CategoryGroup | null>(null);
  const [minRating, setMinRating] = useState(0);
  // 3 = "Any" (no filter) — riskScore's own max is 3, so "3 and below"
  // trivially matches every company, same reasoning minRating's top end
  // (5) already uses for its own "Any" state.
  const [maxRiskScore, setMaxRiskScore] = useState(3);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedDistrictKeys, setSelectedDistrictKeys] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  // The page of cards on screen plus totals (GET /companies/browse?jobs=1).
  const [result, setResult] = useState<CompanyBrowseResult | null>(null);
  const [loading, setLoading] = useState(false);
  // Until the member's profile has been read (and their sector or work type
  // possibly applied), nothing is fetched - so the page doesn't flash every
  // job first and then jump to theirs.
  const [personalised, setPersonalised] = useState(false);
  const [autoFilter, setAutoFilter] = useState<AutoFilter | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [geo, setGeo] = useState<Geo>(null);
  const [geoRequesting, setGeoRequesting] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [page, setPage] = useState(1);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [savedView, setSavedView] = useState(false);
  const { postings: savedPostings, loading: savedLoading, canSave } = useSavedJobPostings();
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const resultsTopRef = useRef<HTMLDivElement>(null);

  function stepRating(delta: number) {
    setMinRating((prev) => Math.min(5, Math.max(0, Math.round((prev + delta) * 10) / 10)));
  }

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

  function requestNearMe() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeo("denied");
      return;
    }
    setGeoRequesting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ nearCity: nearestProvince(pos.coords.latitude, pos.coords.longitude) });
        setGeoRequesting(false);
      },
      () => {
        setGeo("denied");
        setGeoRequesting(false);
      },
      { timeout: 8000 },
    );
  }

  // Opens on the member's own field: their profile Sector if they set one,
  // otherwise their "What kind of work?" choice. Each is only applied if it
  // actually has open jobs right now (checked with the same page request the
  // grid then reuses from cache) - otherwise the next one is tried, and
  // failing both the page shows every job. Never leaves an empty page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await apiGet<MyProfile>("/me/profile");
        const tries: AutoFilter[] = [];
        if (profile.sector) tries.push({ kind: "sector", value: profile.sector.value, label: profile.sector.label });
        if (profile.workType) {
          const label = WORKPLACE_TYPES.find((w) => w.value === profile.workType)?.label ?? profile.workType;
          tries.push({ kind: "workType", value: profile.workType, label });
        }
        for (const t of tries) {
          const params = jobsParams(
            t.kind === "sector" ? { ...NO_FILTERS, selectedCategory: t.value } : { ...NO_FILTERS, workplaceTypes: [t.value] },
          );
          const firstPage = await fetchBrowsePage(params, 1);
          if (cancelled) return;
          if (firstPage.total > 0) {
            if (t.kind === "sector") setSelectedCategory(t.value);
            else setWorkplaceTypes([t.value]);
            setAutoFilter(t);
            break;
          }
        }
      } catch {
        // No profile (or it failed to load): just show every job.
      } finally {
        if (!cancelled) setPersonalised(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Every filter, the sort, Quick Select, Near Me, the Following pick and
  // the page go to the server, which sends back only the 16 cards on screen
  // with their open postings. Filter changes wait 250ms (one request per
  // slider drag, not one per step); page clicks go at once; a page already
  // fetched or fetched ahead shows with no request at all.
  const filterParams = useMemo(
    () =>
      jobsParams({
        query,
        workplaceTypes,
        selectedCities,
        selectedDistrictKeys,
        minRating,
        maxRiskScore,
        selectedCategory,
        categoryGroup,
        sortBy,
        geo,
        selectedCompanyId,
      }),
    [query, workplaceTypes, selectedCities, selectedDistrictKeys, minRating, maxRiskScore, selectedCategory, categoryGroup, sortBy, geo, selectedCompanyId],
  );
  const lastFilterParams = useRef<string | null>(null);

  useEffect(() => {
    if (!personalised) return;
    const filtersChanged = lastFilterParams.current !== null && lastFilterParams.current !== filterParams;
    lastFilterParams.current = filterParams;
    let cancelled = false;
    setLoadError(false);
    setLoading(true);
    const wait = filtersChanged && !hasBrowsePage(filterParams, page) ? 250 : 0;
    const handle = setTimeout(() => {
      fetchBrowsePage(filterParams, page)
        .then((data) => {
          if (cancelled) return;
          setResult(data);
          setLoading(false);
          if (data.page !== page) setPage(data.page);
          if (data.page * data.pageSize < data.total) prefetchBrowsePage(filterParams, data.page + 1);
        })
        .catch(() => {
          if (cancelled) return;
          setResult({ items: [], total: 0, page: 1, pageSize: RESULTS_PAGE_SIZE, hiddenUnratedCount: 0 });
          setLoading(false);
          setLoadError(true);
        });
    }, wait);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [personalised, filterParams, page]);

  // The auto-filter note only stays while that filter is still on.
  const autoFilterActive =
    autoFilter !== null &&
    (autoFilter.kind === "sector"
      ? selectedCategory === autoFilter.value
      : workplaceTypes.length === 1 && workplaceTypes[0] === autoFilter.value);

  function clearAutoFilter() {
    if (autoFilter?.kind === "sector") setSelectedCategory(null);
    else setWorkplaceTypes([]);
    setAutoFilter(null);
  }

  useEffect(() => {
    setSelectedCategory(null);
  }, [workplaceTypes]);

  const sectorOptions = useMemo(() => sectorsForWorkplaceTypes(workplaceTypes), [workplaceTypes]);

  useEffect(() => {
    setPage(1);
  }, [
    workplaceTypes,
    selectedCategory,
    categoryGroup,
    minRating,
    maxRiskScore,
    selectedCities,
    selectedDistrictKeys,
    sortBy,
    query,
    selectedCompanyId,
    geo,
  ]);

  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / RESULTS_PAGE_SIZE));
  const pageCompanies = result?.items ?? null;

  function goToPage(next: number) {
    setPage(next);
    resultsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleWorkplaceType(value: WorkplaceType) {
    setWorkplaceTypes((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (prev.length >= 2) return [value];
      return [...prev, value];
    });
  }

  function resetWorkplaceTypes() {
    setWorkplaceTypes([]);
  }

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
      <div className="w-full max-w-[1600px]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Open roles at companies currently looking for people — same ratings and reviews as the homepage.
          </p>
        </div>

        <SidebarContentRow>
          <SidebarShell>
            {canSave && (
              <>
                <FollowingFilterList selectedCompanyId={selectedCompanyId} onSelect={setSelectedCompanyId} />
                <button
                  type="button"
                  onClick={() => setSavedView((v) => !v)}
                  aria-pressed={savedView}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    savedView
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-border text-foreground hover:bg-surface-muted"
                  }`}
                >
                  <BookmarkIcon className="h-4 w-4" />
                  Saved Posts
                </button>
              </>
            )}
            <div>
              <MultiFilterPillGroup
                heading="Work-Type"
                options={WORKPLACE_TYPES}
                selected={workplaceTypes}
                onToggle={toggleWorkplaceType}
                onReset={resetWorkplaceTypes}
                direction="grid"
                pillColorClassName={collarOutlinedButtonClassName}
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
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rating</h2>
                <RewindButton onClick={() => setMinRating(0)} active={minRating !== 0} title="Reset rating filter" />
              </div>
              <div className="flex flex-col gap-3 rounded-lg px-3 py-3 select-none">
                <div className="relative pt-16">
                  {RATING_TICKS.map((tick, i) => {
                    const active = activeMoodIndex(minRating) === i;
                    return (
                      <Image
                        width={112}
                        height={112}
                        sizes="56px"
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
                    {RATING_TICKS.map((tick) => (
                      <span
                        key={tick.value}
                        className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-white/70"
                        style={{ left: `${(tick.value / 5) * 100}%` }}
                      />
                    ))}
                    <span
                      className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-foreground shadow-sm"
                      style={{ left: `${(minRating / 5) * 100}%` }}
                    />
                  </div>
                </div>

                <span className="text-center text-xs font-normal text-muted-foreground">
                  {minRating === 0 || minRating === 5 ? "Any" : `${minRating.toFixed(1)} and Below`}
                </span>
              </div>
            </div>

            <RiskScoreFilter value={maxRiskScore} onChange={setMaxRiskScore} />

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
          </SidebarShell>

          {/* Results */}
          <div ref={resultsTopRef} className="min-w-0 flex-1">
            {/* Two rows: search + sort in one pill (SearchSortBox) on top,
                then Quick Select on its own row - same layout as the homepage
                (WorkplaceBrowser.tsx). For an owner the Create button sits
                right after the search pill; the block is as wide as the
                Quick Select row, so the button's right edge lines up with
                the last Quick Select pill. */}
            <div className={`mb-4 grid max-w-full gap-3 ${isCompanyOwner ? "w-fit" : ""}`}>
              {isCompanyOwner ? (
                <div className="flex flex-wrap items-stretch gap-2">
                  <SearchSortBox
                    query={query}
                    onQueryChange={setQuery}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    showRiskSort
                    widthClassName="min-w-[16rem] flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setJobFlowOpen(true)}
                    className="flex shrink-0 items-center justify-center rounded-full bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 max-sm:w-full max-sm:py-2"
                  >
                    Create job posting !
                  </button>
                </div>
              ) : (
                <SearchSortBox query={query} onQueryChange={setQuery} sortBy={sortBy} onSortChange={setSortBy} showRiskSort />
              )}
              {/* Same curated category-group quick filter as the rating
                  homepage (WorkplaceBrowser.tsx) — shared markup/config via
                  lib/categoryGroups.tsx, this page's own selection state. */}
              <CategoryGroupFilter value={categoryGroup} onChange={setCategoryGroup} />
            </div>

            {autoFilterActive && !savedView && (
              <p className="mb-3 text-sm text-muted-foreground">
                Showing jobs for your {autoFilter.kind === "sector" ? "sector" : "kind of work"},{" "}
                <span className="font-medium text-foreground">{autoFilter.label}</span>, from your profile.{" "}
                <button type="button" onClick={clearAutoFilter} className="font-medium text-brand-700 underline dark:text-brand-300">
                  Show all jobs
                </button>
              </p>
            )}
            {geo && geo !== "denied" && (
              <p className="mb-3 text-xs text-muted-foreground">Showing workplaces nearest to you first.</p>
            )}
            {geo === "denied" && (
              <p className="mb-3 text-xs text-muted-foreground">
                Couldn&apos;t get your location — showing all workplaces.
              </p>
            )}

            {savedView ? (
              <>
                {savedLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
                {!savedLoading && savedPostings.length === 0 && (
                  <p className="text-sm text-muted-foreground">You haven&apos;t saved any job postings yet.</p>
                )}
                <div className="grid grid-cols-1 gap-4 compact:gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {savedPostings.map((p) => (
                    <JobCard key={p.posting.id} company={p.company} posting={p.posting} expired={p.expired} />
                  ))}
                </div>
              </>
            ) : (
              <>
                {pageCompanies === null && <p className="text-sm text-muted-foreground">Loading...</p>}
                {pageCompanies !== null && pageCompanies.length === 0 && loadError && (
                  <p className="text-sm text-red-600 dark:text-red-300">
                    Couldn&apos;t load workplaces right now — check your connection and try again.
                  </p>
                )}
                {pageCompanies !== null && pageCompanies.length === 0 && !loadError && (
                  <p className="text-sm text-muted-foreground">
                    No companies are looking for people under these filters yet.
                  </p>
                )}
                {/* One card per job (see postingsForCard) — a company with N
                    open postings renders N cards here, not one crowded card. */}
                <div
                  aria-busy={loading}
                  className={`grid grid-cols-1 gap-4 transition-opacity compact:gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
                    loading && pageCompanies !== null ? "opacity-60" : ""
                  }`}
                >
                  {pageCompanies?.flatMap((c) =>
                    postingsForCard(c).map((posting, i) => (
                      <JobCard key={`${c.id}-${posting?.jobTitle ?? "none"}-${i}`} company={c} posting={posting} />
                    )),
                  )}
                </div>

                {total > 0 && (
                  <>
                    <p className="mt-4 text-center text-xs text-muted-foreground">
                      Page {page} of {totalPages} — {total} compan
                      {total === 1 ? "y" : "ies"} hiring
                    </p>
                    <PaginationBar page={page} totalPages={totalPages} onChange={goToPage} />
                  </>
                )}
              </>
            )}
          </div>
        </SidebarContentRow>
      </div>

      {isCompanyOwner && <JobCreationFlow open={jobFlowOpen} onClose={() => setJobFlowOpen(false)} />}
    </div>
  );
}
