"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { type CompanyListItem, type CompanyVibeFlags, type VibeFlag, type WorkplaceType } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { WORKPLACE_TYPES, workplaceTypeLabel } from "@/lib/workplaceTypes";
import { collarSegmentClassName } from "@/lib/collarColors";
import { sectorsForWorkplaceTypes } from "@/lib/sectors";
import { MultiFilterPillGroup } from "@/components/FilterPillGroup";
import { RewindButton } from "@/components/RewindButton";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CityDistrictPicker } from "@/components/CityDistrictPicker";
import { distanceKm, findProvinceByCityName } from "@/lib/turkeyGeo";

// This whole file is a deliberate near-duplicate of WorkplaceBrowser.tsx
// rather than a shared-internals refactor of it — the brief asked for the
// main rating homepage to stay entirely untouched, and this page's own
// filter/sort/search behavior needs to keep evolving independently of it
// (e.g. it always sends includeJobTitles and only ever shows isHiring
// companies). Same reasoning the codebase already uses elsewhere for two
// small, stable, independently-evolving copies of one thing (see
// classifyJobRole.ts's matchesAsWord/foldTr comment) rather than an
// extraction that isn't worth it yet.

type Geo = { lat: number; lng: number } | "denied" | null;

const RATING_TICKS: { value: number; emoji: string }[] = [
  { value: 0, emoji: "😠" },
  { value: 2.5, emoji: "😐" },
  { value: 5, emoji: "😄" },
];

type SortOption = "default" | "alphabetical" | "workplace" | "ratingAsc" | "ratingDesc";

const RESULTS_PAGE_SIZE = 24;

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

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyIconButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy to clipboard"
      aria-label="Copy to clipboard"
      onClick={async () => {
        if (await copyToClipboard(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
    >
      {copied ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

// "Mail us!" / "Call us!" — click opens a small popover to the right with
// the raw value + a copy-to-clipboard icon, rather than a mailto:/tel: link
// (a reviewer-anonymous platform never wants an accidental full mail-client
// handoff to be the only option — copying the address is the more reliable
// action on both desktop and mobile).
function ContactRow({ label, value }: { label: string; value: string | null }) {
  const [open, setOpen] = useState(false);
  if (!value) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-lg border border-border px-3 py-1.5 text-left text-xs font-medium text-foreground transition hover:bg-surface-muted"
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-full top-0 z-20 ml-1 flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground shadow-lg">
          <span>{value}</span>
          <CopyIconButton text={value} />
        </div>
      )}
    </div>
  );
}

const VIBE_FLAG_ROW_ORDER = ["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"];

// Compact popover version of WorkplaceVibeFlags.tsx (that component is a
// fixed lg:h-[672px] page-section box, far too large for a card's dropdown
// menu) — pools every work-type's flags into one flat green/red list,
// deduped by category+cluster, capped so the popover stays small.
function VibeFlagsPopover({ companySlug }: { companySlug: string }) {
  const [data, setData] = useState<CompanyVibeFlags | null | "error">(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<CompanyVibeFlags>(`/companies/${companySlug}/vibe-flags`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData("error");
      });
    return () => {
      cancelled = true;
    };
  }, [companySlug]);

  if (data === null) return <p className="p-1 text-xs text-muted-foreground">Loading...</p>;
  if (data === "error") return <p className="p-1 text-xs text-muted-foreground">Couldn&apos;t load flags.</p>;

  const allFlags = data.byWorkplaceType.flatMap((s) => s.flags);
  const seen = new Set<string>();
  const pooled: VibeFlag[] = [];
  for (const category of VIBE_FLAG_ROW_ORDER) {
    for (const flag of allFlags.filter((f) => f.category === category)) {
      const key = `${flag.category}-${flag.cluster}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pooled.push(flag);
    }
  }
  if (pooled.length === 0) {
    return <p className="p-1 text-xs text-muted-foreground">No flags yet.</p>;
  }

  return (
    <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
      {pooled.map((f) => (
        <li key={`${f.category}-${f.cluster}`} className="flex items-center gap-1.5 text-xs">
          <span aria-hidden="true">{f.color === "GREEN" ? "✅" : "🚩"}</span>
          <span className="truncate text-foreground">{f.label}</span>
        </li>
      ))}
    </ul>
  );
}

// One job card: 4:5 aspect main box (logo+name header, address/sector,
// job titles + contact, rating + vibe-flags "i" menu) plus a General
// Information footer strip below the box — see the layout notes in the PR
// description for why the footer sits outside the aspect box.
function JobCard({ company }: { company: CompanyListItem }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const location = [company.district, company.city].filter(Boolean).join(", ");
  const postedTitles =
    company.jobPostings.length > 0 ? company.jobPostings.map((p) => p.jobTitle) : company.jobTitles;

  return (
    // No overflow-hidden here (unlike a typical image-topped card) — the "i"
    // button's flag dropdown and the contact popovers are absolutely
    // positioned to spill outside this box, and clipping it would make them
    // invisible.
    <div className="flex flex-col rounded-xl border border-border bg-surface transition hover:border-brand-300 dark:hover:border-brand-700">
      <div className="flex aspect-[4/5] flex-col p-4 compact:p-3">
        {/* Top row: logo + name (top-left) ... spacer + rating + info button (top-right) */}
        <div className="flex items-start justify-between gap-2">
          <Link href={`/companies/${company.slug}`} className="flex min-w-0 items-center gap-2">
            <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="sm" />
            <span className="truncate font-semibold text-foreground">{company.name}</span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-bold text-foreground" title="User rating">
              {company.overallAvg !== null ? company.overallAvg.toFixed(1) : "—"}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setInfoOpen((v) => !v)}
                aria-label="Workplace flags"
                aria-expanded={infoOpen}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-[11px] font-bold leading-none text-muted-foreground transition hover:bg-surface-muted"
              >
                i
              </button>
              {infoOpen && (
                <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-lg border border-border bg-surface p-2 shadow-lg">
                  <VibeFlagsPopover companySlug={company.slug} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Address + sector, light weight */}
        <p className="mt-1.5 truncate text-xs font-light text-muted-foreground">
          {location || "Location not set"} · {company.category}
        </p>

        {/* Job titles/postings (bold) + Contact, side by side */}
        {/* No overflow-hidden here — the Contact column's Mail us!/Call us!
            popovers are absolutely positioned to spill outside this row. */}
        <div className="mt-3 flex flex-1 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap content-start gap-1">
            {postedTitles.length > 0 ? (
              postedTitles.map((title, i) => (
                <span
                  key={`${title}-${i}`}
                  className="truncate rounded-full bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                >
                  {title}
                </span>
              ))
            ) : (
              <span className="text-xs font-bold text-muted-foreground">No open roles listed yet</span>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contact</h4>
            <ContactRow label="Mail us!" value={company.contactEmail} />
            <ContactRow label="Call us!" value={company.contactPhone} />
          </div>
        </div>
      </div>

      {/* Card footer, below the main content box */}
      <div className="border-t border-border p-3 compact:p-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          General Information
        </h4>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {company.workplaceTypes.map(workplaceTypeLabel).join(" / ")}
          {company.isVerifiedBadge ? " · Verified" : ""}
          {company.isChainStore ? " · Chain store" : ""}
          {" · "}
          {company.reviewCount} review{company.reviewCount === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

// Compact list beside the main grid — company names and plain rating
// numbers only, nothing else, per the brief.
function HiringRatingSidebar({ companies }: { companies: CompanyListItem[] }) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col gap-2 xl:flex">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Companies Hiring</h3>
      <div className="thin-scrollbar flex max-h-[75vh] flex-col gap-0.5 overflow-y-auto rounded-xl border border-border bg-surface p-2">
        {companies.map((c) => (
          <Link
            key={c.id}
            href={`/companies/${c.slug}`}
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-surface-muted"
          >
            <span className="truncate text-foreground">{c.name}</span>
            <span className="shrink-0 font-semibold text-foreground">
              {c.overallAvg !== null ? c.overallAvg.toFixed(1) : "—"}
            </span>
          </Link>
        ))}
        {companies.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No companies yet.</p>}
      </div>
    </aside>
  );
}

function distanceOf(company: CompanyListItem, geo: { lat: number; lng: number }): number {
  const province = findProvinceByCityName(company.city);
  if (!province) return Infinity;
  return distanceKm(geo.lat, geo.lng, province.lat, province.lng);
}

export function JobsBrowser() {
  const [workplaceTypes, setWorkplaceTypes] = useState<WorkplaceType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedDistrictKeys, setSelectedDistrictKeys] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyListItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [geo, setGeo] = useState<Geo>(null);
  const [geoRequesting, setGeoRequesting] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [page, setPage] = useState(1);
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

  // Same GET /companies endpoint the rating homepage uses (WorkplaceBrowser),
  // plus includeJobTitles=1 — the one addition that scopes results to
  // isHiring companies and attaches each one's classified job titles. No
  // separate/isolated jobs endpoint.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (workplaceTypes.length > 0) params.set("workplaceTypes", workplaceTypes.join(","));
    if (selectedCities.length > 0) params.set("cities", selectedCities.join(","));
    if (selectedDistrictKeys.length > 0) params.set("districtKeys", selectedDistrictKeys.join(","));
    if (minRating > 0) params.set("minRating", String(minRating));
    params.set("includeJobTitles", "1");

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

  useEffect(() => {
    setSelectedCategory(null);
  }, [workplaceTypes]);

  const sectorOptions = useMemo(() => sectorsForWorkplaceTypes(workplaceTypes), [workplaceTypes]);

  const visibleCompanies = useMemo(() => {
    if (!companies) return null;
    let list = selectedCategory ? companies.filter((c) => c.category === selectedCategory) : companies;

    if (sortBy === "alphabetical") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "ratingDesc") {
      list = [...list].sort((a, b) => (b.overallAvg ?? -1) - (a.overallAvg ?? -1));
    } else if (sortBy === "ratingAsc") {
      list = [...list].sort((a, b) => (a.overallAvg ?? Infinity) - (b.overallAvg ?? Infinity));
    } else if (sortBy === "workplace") {
      const order = WORKPLACE_TYPES.map((t) => t.value);
      list = [...list].sort((a, b) => order.indexOf(a.workplaceTypes[0]) - order.indexOf(b.workplaceTypes[0]));
    } else if (geo && geo !== "denied") {
      list = [...list].sort((a, b) => distanceOf(a, geo) - distanceOf(b, geo));
    }
    return list;
  }, [companies, selectedCategory, geo, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [workplaceTypes, selectedCategory, minRating, selectedCities, selectedDistrictKeys, sortBy, query]);

  const totalPages = visibleCompanies ? Math.max(1, Math.ceil(visibleCompanies.length / RESULTS_PAGE_SIZE)) : 1;
  const pageCompanies = visibleCompanies?.slice((page - 1) * RESULTS_PAGE_SIZE, page * RESULTS_PAGE_SIZE) ?? null;

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
              <div className="flex flex-col gap-3 rounded-lg px-3 py-3 select-none overflow-hidden">
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
          <div ref={resultsTopRef} className="min-w-0 flex-1">
            <div className="mb-4 flex items-center gap-2">
              <input
                type="search"
                placeholder="Search a workplace by name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full max-w-sm rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground"
              />
              <div className="ml-auto flex items-center gap-1 rounded-xl border border-zinc-800/60 bg-zinc-950/80 p-1">
                <button
                  type="button"
                  onClick={() => setSortBy((s) => (s === "alphabetical" ? "default" : "alphabetical"))}
                  aria-pressed={sortBy === "alphabetical"}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    sortBy === "alphabetical" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  A-Z
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy((s) => (s === "workplace" ? "default" : "workplace"))}
                  aria-pressed={sortBy === "workplace"}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    sortBy === "workplace" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
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
                      ? "border border-red-800/50 bg-red-950/40 text-red-400"
                      : sortBy === "ratingDesc"
                        ? "border border-emerald-800/50 bg-emerald-950/40 text-emerald-400"
                        : "text-zinc-400 hover:text-zinc-200"
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
              <p className="text-sm text-muted-foreground">
                No companies are looking for people under these filters yet.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 compact:gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {pageCompanies?.map((c) => (
                <JobCard key={c.id} company={c} />
              ))}
            </div>

            {visibleCompanies !== null && visibleCompanies.length > 0 && (
              <>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Page {page} of {totalPages} — {visibleCompanies.length} compan
                  {visibleCompanies.length === 1 ? "y" : "ies"} hiring
                </p>
                <PaginationBar page={page} totalPages={totalPages} onChange={goToPage} />
              </>
            )}
          </div>

          <HiringRatingSidebar companies={visibleCompanies ?? []} />
        </div>
      </div>
    </div>
  );
}
