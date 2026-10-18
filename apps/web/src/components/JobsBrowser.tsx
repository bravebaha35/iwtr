"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type SortOption } from "@/components/SortButtons";
import { SearchSortBox } from "@/components/SearchSortBox";
import { AdSlot } from "@/components/AdSlot";
import { EmployerAdSlot } from "@/components/EmployerAdSlot";
import Image from "next/image";
import {
  JOBS_BROWSE_PAGE_SIZE,
  findProvinceByCityName,
  findRegionByProvinceName,
  regionLabel,
  type CompanyBrowseResult,
  type JobPosition,
  type MyProfile,
  type WorkplaceType,
} from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";
import { useAuth } from "@/lib/auth-context";
import { fetchBrowsePage, hasBrowsePage, prefetchBrowsePage } from "@/lib/companyBrowse";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";
import { sectorsForWorkplaceTypes } from "@/lib/sectors";
import { type CategoryGroup, CategoryGroupFilter } from "@/lib/categoryGroups";
import { WorkTypeTiles } from "@/components/WorkTypeTiles";
import { JOB_POSITIONS } from "@/lib/jobPositions";
import { RewindButton } from "@/components/RewindButton";
import { MultiSelectDropdown } from "@/components/Dropdown";
import { CityDistrictPicker } from "@/components/CityDistrictPicker";
import { JobCard, postingsForCard } from "@/components/jobs/JobCard";
import { JobCreationFlow } from "@/components/jobs/JobCreationFlow";
import { distanceKm, TURKEY_PROVINCES } from "@/lib/turkeyGeo";
import { useFollowedCompanies } from "@/lib/useFollowedCompanies";
import { useSavedJobPostings } from "@/lib/useSavedJobPostings";
import { BookmarkIcon } from "@/components/jobs/BookmarkIcon";
import { CardGridSkeleton } from "@/components/CardGridSkeleton";
import { RiskScoreFilter } from "@/components/jobs/RiskScoreFilter";
import { SidebarShell, SidebarContentRow } from "@/components/layout/SidebarShell";
import { useT } from "@/lib/i18n/client";

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


// 4 across and 5 rows of job cards a page, the same grid as the homepage.
// Page 1 gives up to 2 of those rows to the Featured ads (8 featured -> 12
// standard cards under them); the server does that arithmetic and says how
// many pages there are (CompaniesService.browseJobs).
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
  onIntent,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  // The pointer or keyboard is on a page button: fetch that page now, so the
  // click shows it at once. Only pages someone is about to open are fetched.
  onIntent?: (page: number) => void;
}) {
  const t = useT();
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-10 flex items-center justify-center gap-1 text-sm" aria-label={t("Pagination")}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        onPointerEnter={() => page > 1 && onIntent?.(page - 1)}
        onFocus={() => page > 1 && onIntent?.(page - 1)}
        disabled={page === 1}
        aria-label={t("Previous page")}
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
            onPointerEnter={() => p !== page && onIntent?.(p)}
            onFocus={() => p !== page && onIntent?.(p)}
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
        onPointerEnter={() => page < totalPages && onIntent?.(page + 1)}
        onFocus={() => page < totalPages && onIntent?.(page + 1)}
        disabled={page === totalPages}
        aria-label={t("Next page")}
        className="rounded-lg px-2.5 py-1.5 text-muted-foreground transition hover:bg-surface-muted disabled:opacity-30"
      >
        ›
      </button>
    </nav>
  );
}


// The member's profile Sector and kind of work - only used to choose which
// featured ads come first; the job grid itself always starts unfiltered.
type MemberField = { sector: { value: string; label: string } | null; workType: WorkplaceType | null };
const NO_FIELD: MemberField = { sector: null, workType: null };

// The member's field, read once and kept while the tab is open (it changes
// only when they edit their profile), so coming back to Jobs asks nothing.
const FIELD_KEEP_MS = 10 * 60_000;
let rememberedField: { at: number; read: Promise<MemberField> } | null = null;

function readMemberField(): Promise<MemberField> {
  if (rememberedField && Date.now() - rememberedField.at < FIELD_KEEP_MS) return rememberedField.read;
  const read = apiGet<MyProfile>("/me/profile").then(
    (p): MemberField => ({ sector: p.sector ?? null, workType: p.workType ?? null }),
    () => NO_FIELD,
  );
  rememberedField = { at: Date.now(), read };
  return read;
}

/** Test hook: forget the remembered field. */
export function forgetMemberField(): void {
  rememberedField = null;
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
  selectedCategories: string[];
  positions: JobPosition[];
  categoryGroup: CategoryGroup | null;
  sortBy: SortOption;
  geo: Geo;
  selectedCompanyId: string | null;
  // The member's own field, for the featured row only (see pickFeatured on
  // the API): sent only while the sidebar has no work type or sector picked.
  field: MemberField;
}): string {
  const params = new URLSearchParams();
  params.set("jobs", "1");
  if (f.query.trim()) params.set("q", f.query.trim());
  if (f.workplaceTypes.length > 0) params.set("workplaceTypes", f.workplaceTypes.join(","));
  if (f.selectedCities.length > 0) params.set("cities", f.selectedCities.join(","));
  if (f.selectedDistrictKeys.length > 0) params.set("districtKeys", f.selectedDistrictKeys.join(","));
  if (f.minRating > 0) params.set("minRating", String(f.minRating));
  if (f.maxRiskScore < 3) params.set("maxRiskScore", String(f.maxRiskScore));
  // "|" between sectors: a sector name can contain a comma.
  if (f.selectedCategories.length > 0) params.set("categories", f.selectedCategories.join("|"));
  if (f.positions.length > 0) params.set("positions", f.positions.join(","));
  if (f.categoryGroup) params.set("categoryGroup", f.categoryGroup);
  if (f.sortBy !== "default") params.set("sort", f.sortBy);
  if (f.geo && f.geo !== "denied") params.set("nearCity", f.geo.nearCity);
  if (f.selectedCompanyId) params.set("companyId", f.selectedCompanyId);
  if (f.workplaceTypes.length === 0 && f.selectedCategories.length === 0) {
    if (f.field.sector) params.set("forSector", f.field.sector.value);
    if (f.field.workType) params.set("forWorkType", f.field.workType);
  }
  return params.toString();
}

// Same data source as SocialSidebar's FollowingList (useFollowedCompanies),
// but a single-select CLIENT-SIDE FILTER instead of navigation — clicking a
// name narrows the results grid to that one company; clicking the same name
// again clears the filter and restores the unfiltered view. Not shared with
// SocialSidebar's version since the click behavior is genuinely different,
// matching this file's own standing near-duplicate policy (see the
// file-header comment above).
/**
 * The companies the member follows, as one horizontal row above the results
 * (pick one to see only its jobs). Arrows appear at the ends when the row is
 * longer than the space it has.
 */
function FollowingFilterList({
  selectedCompanyId,
  onSelect,
}: {
  selectedCompanyId: string | null;
  onSelect: (companyId: string | null) => void;
}) {
  const { companies, loading } = useFollowedCompanies();
  const t = useT();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () =>
      setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [companies.length]);

  function scrollBy(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: direction * Math.max(200, el.clientWidth * 0.7), behavior: "smooth" });
  }

  const arrow =
    "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-foreground shadow-md ring-1 ring-border transition hover:bg-surface-muted";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <h2 className="shrink-0 text-[13px] font-semibold text-foreground">{t("Following")}</h2>
      <div className="relative min-w-0 flex-1">
        <div ref={scrollerRef} className="no-scrollbar flex gap-1.5 overflow-x-auto scroll-smooth py-1">
          {loading && <p className="px-1 py-1.5 text-xs text-muted-foreground">{t("Loading...")}</p>}
          {!loading && companies.length === 0 && (
            <p className="px-1 py-1.5 text-xs text-muted-foreground">{t("You're not following any companies yet.")}</p>
          )}
          {companies.map((c) => (
            <button
              key={c.companyId}
              type="button"
              onClick={() => onSelect(selectedCompanyId === c.companyId ? null : c.companyId)}
              aria-pressed={selectedCompanyId === c.companyId}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
                selectedCompanyId === c.companyId
                  ? "bg-brand-600 font-semibold text-white"
                  : "bg-surface-muted text-foreground hover:bg-border/70"
              }`}
            >
              {c.companyName}
            </button>
          ))}
        </div>
        {edges.start && (
          <button type="button" onClick={() => scrollBy(-1)} aria-label={t("Show earlier companies")} className={`${arrow} -left-2`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
        )}
        {edges.end && (
          <button type="button" onClick={() => scrollBy(1)} aria-label={t("Show more companies")} className={`${arrow} -right-2`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export function JobsBrowser() {
  const isCompanyOwner = useIsCompanyOwner();
  const t = useT();
  const [jobFlowOpen, setJobFlowOpen] = useState(false);
  const [workplaceTypes, setWorkplaceTypes] = useState<WorkplaceType[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // The Position filter: postings hiring for any one of the ticked levels.
  const [positions, setPositions] = useState<JobPosition[]>([]);
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
  const [loadError, setLoadError] = useState(false);
  const [geo, setGeo] = useState<Geo>(null);
  const [geoRequesting, setGeoRequesting] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [page, setPage] = useState(1);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  // null until the profile has been read, so the page doesn't fetch twice.
  const [field, setField] = useState<MemberField | null>(null);
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

  // Reads the member's Sector / kind of work once, for the featured row. A
  // visitor, owner or company login simply has none - and is not asked.
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || role !== "MEMBER") {
      setField(NO_FIELD);
      return;
    }
    let cancelled = false;
    void readMemberField().then((next) => {
      if (!cancelled) setField(next);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, role]);

  // Every filter, the sort, Quick Select, Near Me, the Following pick and
  // the page go to the server, which sends back only the job cards on
  // screen. Filter changes wait 250ms (one request per
  // slider drag, not one per step); page clicks go at once; a page already
  // fetched (or fetched when the pointer reached its button) shows with no
  // request at all. Nothing is fetched ahead that nobody asked for.
  const filterParams = useMemo(
    () =>
      jobsParams({
        query,
        workplaceTypes,
        selectedCities,
        selectedDistrictKeys,
        minRating,
        maxRiskScore,
        selectedCategories,
        positions,
        categoryGroup,
        sortBy,
        geo,
        selectedCompanyId,
        field: field ?? NO_FIELD,
      }),
    [query, workplaceTypes, selectedCities, selectedDistrictKeys, minRating, maxRiskScore, selectedCategories, positions, categoryGroup, sortBy, geo, selectedCompanyId, field],
  );
  const lastFilterParams = useRef<string | null>(null);

  useEffect(() => {
    if (field === null) return;
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
        })
        .catch(() => {
          if (cancelled) return;
          setResult({ items: [], total: 0, page: 1, pageSize: RESULTS_PAGE_SIZE, hiddenUnratedCount: 0, featured: [] });
          setLoading(false);
          setLoadError(true);
        });
    }, wait);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [filterParams, page, field]);

  useEffect(() => {
    setSelectedCategories([]);
  }, [workplaceTypes]);

  const sectorOptions = useMemo(() => sectorsForWorkplaceTypes(workplaceTypes), [workplaceTypes]);

  useEffect(() => {
    setPage(1);
  }, [
    workplaceTypes,
    selectedCategories,
    positions,
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
  const totalPages = Math.max(1, result?.totalPages ?? Math.ceil(total / RESULTS_PAGE_SIZE));
  const pageCompanies = result?.items ?? null;
  // Page 1 only: boosted postings get their own row above the rest (see
  // CompaniesService.featuredJobs). The server already leaves them out of
  // the standard cards on every page, so no job shows twice; the same check
  // here is only a second line of defence.
  const featured = page === 1 ? (result?.featured ?? []) : [];
  // Says whose field the featured row was picked for, while it was.
  const usesField = workplaceTypes.length === 0 && selectedCategories.length === 0;
  const fieldNote = !usesField
    ? null
    : field?.sector && featured.some((f) => f.company.category === field.sector!.value)
      ? t(field.sector.label)
      : field?.workType && featured.some((f) => f.posting.workType === field.workType)
        ? t(WORKPLACE_TYPES.find((w) => w.value === field.workType)?.label ?? "")
        : null;
  // A place is chosen but some featured ads are from elsewhere: there were
  // fewer than 4 in that place, so the row was topped up from the same
  // region (pickFeatured on the API). Say so, rather than leave people
  // wondering why Manisa shows up under İzmir.
  const chosenPlaces = [...new Set([...selectedCities, ...selectedDistrictKeys.map((k) => k.split("::")[0])])];
  const chosenProvinces = new Set(chosenPlaces.map((c) => findProvinceByCityName(c)?.name ?? c));
  const regionFill =
    chosenPlaces.length > 0 &&
    featured.some((f) => !chosenProvinces.has(findProvinceByCityName(f.company.city)?.name ?? f.company.city ?? ""));
  const chosenRegion = regionFill ? findRegionByProvinceName(chosenPlaces[0]) : null;
  const regionFillNote = regionFill
    ? chosenRegion
      ? t("Fewer than 4 featured ads in {places}, so this row also shows featured ads from the same region ({region}).", {
          places: chosenPlaces.join(", "),
          region: t(regionLabel(chosenRegion)),
        })
      : t("Fewer than 4 featured ads in {places}, so this row also shows featured ads from the same region.", { places: chosenPlaces.join(", ") })
    : null;
  const featuredIds = new Set(featured.map((f) => f.posting.id));
  const standardCards = (pageCompanies ?? []).flatMap((c) => {
    const postings = postingsForCard(c);
    const remaining = postings.filter((p) => !p?.id || !featuredIds.has(p.id));
    return remaining.length === 0 ? [] : remaining.map((posting) => ({ company: c, posting }));
  });

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
    setSelectedCategories([]);
  }

  function toggleCategory(value: string) {
    setSelectedCategories((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function togglePosition(value: JobPosition) {
    setPositions((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }



  function resetLocation() {
    setSelectedCities([]);
    setSelectedDistrictKeys([]);
  }

  return (
    // Same frame as the rating homepage (WorkplaceBrowser): an ad rail on
    // each side, so the filters and the 4-across grid line up on both pages.
    <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
      <AdSlot />

      <div className="w-full min-w-0 max-w-[1600px]">
        <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:gap-8">
          <div className="shrink-0">
            <h1 className="text-4xl leading-tight text-foreground">{t("Jobs")}</h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              {t("Open roles at companies currently looking for people, with the same ratings and reviews as the homepage.")}
            </p>
          </div>
          {/* Members: the companies they follow in one row, and their saved
              posts behind the bookmark at the end. */}
          {canSave && (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <FollowingFilterList selectedCompanyId={selectedCompanyId} onSelect={setSelectedCompanyId} />
              <button
                type="button"
                onClick={() => setSavedView((v) => !v)}
                aria-pressed={savedView}
                aria-label={t("Saved Posts")}
                title={t("Saved Posts")}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${
                  savedView ? "bg-brand-600 text-white" : "bg-surface-muted text-foreground hover:bg-border/70"
                }`}
              >
                <BookmarkIcon className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <SidebarContentRow>
          <SidebarShell>
            {/* Employers only: the first thing in the sidebar, above Work-Type. */}
            {isCompanyOwner && (
              <button
                type="button"
                onClick={() => setJobFlowOpen(true)}
                title={t("Create a job posting")}
                className="flex items-center justify-center rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]"
              >
                {t("Create !")}
              </button>
            )}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-foreground">{t("Work-Type")}</h2>
                <RewindButton
                  onClick={resetWorkplaceTypes}
                  active={workplaceTypes.length > 0 || selectedCategories.length > 0}
                  title="Clear Work-Type and Sector filter"
                />
              </div>
              <WorkTypeTiles selected={workplaceTypes} onToggle={toggleWorkplaceType} />
              {/* A tick list: several sectors can be on at once. */}
              <div className="mt-2">
                <MultiSelectDropdown
                  values={selectedCategories}
                  options={sectorOptions}
                  placeholder="Sector"
                  countNoun="sectors"
                  onToggle={toggleCategory}
                  onClear={() => setSelectedCategories([])}
                />
              </div>
            </div>



            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-foreground">{t("Rating")}</h2>
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
                    title={t("Click and drag along the slider, or scroll, to fine-tune")}
                  >
                    <span
                      className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-foreground shadow-sm"
                      style={{ left: `${(minRating / 5) * 100}%` }}
                    />
                  </div>
                </div>

                <span className="text-center text-xs font-normal text-muted-foreground">
                  {minRating === 0 || minRating === 5 ? t("Any") : t("{n} and Below", { n: minRating.toFixed(1) })}
                </span>
              </div>
            </div>

            <RiskScoreFilter value={maxRiskScore} onChange={setMaxRiskScore} />

            {/* Order: Work-Type, Rating, Risk Score, then Location (one city at a time). */}
            <CityDistrictPicker
              selectedCities={selectedCities}
              selectedDistrictKeys={selectedDistrictKeys}
              onChange={({ cities, districtKeys }) => {
                setSelectedCities(cities);
                setSelectedDistrictKeys(districtKeys);
              }}
              onReset={resetLocation}
              onNearMe={requestNearMe}
              nearMeLoading={geoRequesting}
              nearMeActive={geo !== null && geo !== "denied"}
            />

            {/* Position: the same levels an owner ticks when posting a job.
                Any number can be on; a posting hiring for any one of them
                is listed. */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-foreground">{t("Position")}</h2>
                <RewindButton onClick={() => setPositions([])} active={positions.length > 0} title="Clear Position filter" />
              </div>
              {/* A pill like Sector: opens a tick list, stays open while
                  ticking, closes on a click anywhere else. */}
              <MultiSelectDropdown
                values={positions}
                options={JOB_POSITIONS}
                placeholder="Position"
                countNoun="positions"
                onToggle={(value) => togglePosition(value as JobPosition)}
                onClear={() => setPositions([])}
                searchable={false}
                maxHeightClassName="max-h-none"
              />
            </div>
          </SidebarShell>

          {/* Results */}
          <div ref={resultsTopRef} className="min-w-0 flex-1">
            {/* Two rows: the search field with the sort buttons right next
                to it (SearchSortBox) on top, then Quick Select on its own
                row - same layout as the homepage (WorkplaceBrowser.tsx). */}
            {/* The employer ad space sits beside the search + Quick Select
                block on wide screens. */}
            <div className="mb-7 flex items-stretch gap-4">
            <div className="grid min-w-0 max-w-full gap-3">
              <SearchSortBox query={query} onQueryChange={setQuery} sortBy={sortBy} onSortChange={setSortBy} showRiskSort />
              {/* Same curated category-group quick filter as the rating
                  homepage (WorkplaceBrowser.tsx) — shared markup/config via
                  lib/categoryGroups.tsx, this page's own selection state. */}
              <CategoryGroupFilter value={categoryGroup} onChange={setCategoryGroup} />
            </div>
            <EmployerAdSlot />
            </div>

            {geo && geo !== "denied" && (
              <p className="mb-3 text-xs text-muted-foreground">{t("Showing workplaces nearest to you first.")}</p>
            )}
            {geo === "denied" && (
              <p className="mb-3 text-xs text-muted-foreground">
                {t("Couldn't get your location - showing all workplaces.")}
              </p>
            )}

            {savedView ? (
              <>
                {savedLoading && <p className="text-sm text-muted-foreground">{t("Loading...")}</p>}
                {!savedLoading && savedPostings.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("You haven't saved any job postings yet.")}</p>
                )}
                <div className="grid grid-cols-1 gap-5 compact:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {savedPostings.map((p) => (
                    <JobCard key={p.posting.id} company={p.company} posting={p.posting} expired={p.expired} variant="compact" />
                  ))}
                </div>
              </>
            ) : (
              <>
                {pageCompanies === null && <CardGridSkeleton />}
                {pageCompanies !== null && pageCompanies.length === 0 && loadError && (
                  <p className="text-sm text-red-600 dark:text-red-300">
                    {t("Couldn't load workplaces right now - check your connection and try again.")}
                  </p>
                )}
                {featured.length > 0 && (
                  <section aria-label={t("Featured jobs")} className={`transition-opacity ${loading ? "opacity-60" : ""}`}>
                    <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#3b6b54] dark:text-[#7fb59a]">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                        <path d="M12 0c.6 5.6 2.4 7.4 12 12-9.6 4.6-11.4 6.4-12 12-.6-5.6-2.4-7.4-12-12 9.6-4.6 11.4-6.4 12-12Z" />
                      </svg>
                      {t("Featured jobs")}
                      {fieldNote && (
                        <span className="font-normal normal-case tracking-normal text-muted-foreground">
                          {" "}
                          {t("- picked for {field}", { field: fieldNote })}
                        </span>
                      )}
                    </h2>
                    {regionFillNote && <p className="-mt-1 mb-3 text-sm text-muted-foreground">{regionFillNote}</p>}
                    <div className="grid grid-cols-1 gap-5 compact:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {featured.map((f) => (
                        <JobCard key={f.posting.id} company={f.company} posting={f.posting} variant="compact" boosted />
                      ))}
                    </div>
                    {/* The line between the featured row and the standard jobs. */}
                    <div role="separator" className="my-6 flex items-center gap-3 text-xs font-medium text-muted-foreground">
                      <span className="h-px flex-1 bg-foreground/40" />
                      {t("All jobs")}
                      <span className="h-px flex-1 bg-foreground/40" />
                    </div>
                  </section>
                )}

                {/* Under the featured row (and its "All jobs" line), so it
                    reads as "nothing in the normal list" and never contradicts
                    featured ads shown above it. */}
                {pageCompanies !== null && pageCompanies.length === 0 && !loadError && (
                  <p className="text-sm text-muted-foreground">
                    {regionFill
                      ? t("No companies in {places} are looking for people under these filters yet. The featured ads above are from the same region.", { places: chosenPlaces.join(", ") })
                      : positions.length > 0
                        ? t("No job posting is hiring for the ticked position under these filters yet.")
                        : t("No companies are looking for people under these filters yet.")}
                  </p>
                )}

                {/* One card per job (see postingsForCard) — a company with N
                    open postings renders N cards here, not one crowded card. */}
                <div
                  aria-busy={loading}
                  className={`grid grid-cols-1 gap-5 transition-opacity compact:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
                    loading && pageCompanies !== null ? "opacity-60" : ""
                  }`}
                >
                  {standardCards.map(({ company: c, posting }, i) => (
                    <JobCard
                      key={`${c.id}-${posting?.id ?? posting?.jobTitle ?? "none"}-${i}`}
                      company={c}
                      posting={posting}
                      variant="compact"
                    />
                  ))}
                </div>

                {total > 0 && (
                  <>
                    <p className="mt-4 text-center text-xs text-muted-foreground">
                      {t(total === 1 ? "Page {page} of {pages} - {total} job listing" : "Page {page} of {pages} - {total} job listings", { page, pages: totalPages, total })}
                    </p>
                    <PaginationBar page={page} totalPages={totalPages} onChange={goToPage} onIntent={(p) => prefetchBrowsePage(filterParams, p)} />
                  </>
                )}
              </>
            )}
          </div>
        </SidebarContentRow>
      </div>

      <AdSlot side="right" />

      {isCompanyOwner && <JobCreationFlow open={jobFlowOpen} onClose={() => setJobFlowOpen(false)} />}
    </div>
  );
}
