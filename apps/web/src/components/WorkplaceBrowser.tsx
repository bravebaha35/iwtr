"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { scoreBandLabel, type CompanyListItem, type WorkplaceType } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { scoreTextColor } from "@/lib/scoreBandColors";
import { WORKPLACE_TYPES, workplaceTypeLabel } from "@/lib/workplaceTypes";
import { MultiFilterPillGroup } from "@/components/FilterPillGroup";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CityDistrictPicker, districtKey } from "@/components/CityDistrictPicker";
import { AdSlot } from "@/components/AdSlot";
import { distanceKm, findProvinceByCityName } from "@/lib/turkeyGeo";

type Geo = { lat: number; lng: number } | "denied" | null;

function CompanyCard({ company }: { company: CompanyListItem }) {
  return (
    <Link
      href={`/companies/${company.slug}`}
      className="flex flex-col gap-3 compact:gap-1.5 rounded-xl border border-border bg-surface p-4 compact:p-2.5 transition hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700"
    >
      <div className="flex items-center gap-3 compact:gap-2">
        <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="md" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground compact:text-sm">{company.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {workplaceTypeLabel(company.workplaceType)} · {company.category}
            {company.city ? ` · ${company.city}` : ""}
            {company.district ? `, ${company.district}` : ""}
          </p>
        </div>
      </div>

      {company.overallAvg !== null ? (
        <div className="flex items-baseline gap-2">
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
        <p className="text-xs text-muted-foreground">No reviews yet</p>
      )}
    </Link>
  );
}

function distanceOf(company: CompanyListItem, geo: { lat: number; lng: number }): number {
  const province = findProvinceByCityName(company.city);
  if (!province) return Infinity;
  return distanceKm(geo.lat, geo.lng, province.lat, province.lng);
}

function matchesCityDistrict(company: CompanyListItem, cities: string[], districtKeys: string[]): boolean {
  const province = findProvinceByCityName(company.city);
  const cityName = province?.name ?? company.city;
  if (cityName && cities.includes(cityName)) return true;
  if (cityName && company.district && districtKeys.includes(districtKey(cityName, company.district))) return true;
  return false;
}

export function WorkplaceBrowser({ defaultCity }: { defaultCity: string | null }) {
  const [workplaceTypes, setWorkplaceTypes] = useState<WorkplaceType[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedDistrictKeys, setSelectedDistrictKeys] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyListItem[] | null>(null);
  const [geo, setGeo] = useState<Geo>(null);

  // Try to sort by proximity first. If denied/unavailable, fall back to the
  // visitor's own onboarding city (if set) rather than leaving everything
  // unfiltered — see CityDistrictPicker below for manually narrowing further.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeo("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeo("denied"),
      { timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    if (geo !== "denied" || !defaultCity) return;
    const province = findProvinceByCityName(defaultCity);
    if (province) setSelectedCities((prev) => (prev.length === 0 ? [province.name] : prev));
    // Only meant to seed the initial filter once geolocation resolves to
    // denied — deliberately not re-running if the visitor later clears it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());

    let cancelled = false;
    const handle = setTimeout(() => {
      apiGet<CompanyListItem[]>(`/companies?${params.toString()}`)
        .then((data) => {
          if (!cancelled) setCompanies(data);
        })
        .catch(() => {
          if (!cancelled) setCompanies([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const visibleCompanies = useMemo(() => {
    if (!companies) return null;
    let list = companies.filter((c) => {
      if (workplaceTypes.length > 0 && !workplaceTypes.includes(c.workplaceType)) return false;
      if (minRating > 0 && (c.overallAvg === null || c.overallAvg < minRating)) return false;
      if (selectedCities.length > 0 || selectedDistrictKeys.length > 0) {
        if (!matchesCityDistrict(c, selectedCities, selectedDistrictKeys)) return false;
      }
      return true;
    });

    if (geo && geo !== "denied") {
      list = [...list].sort((a, b) => distanceOf(a, geo) - distanceOf(b, geo));
    }
    return list;
  }, [companies, workplaceTypes, minRating, selectedCities, selectedDistrictKeys, geo]);

  function toggleWorkplaceType(value: WorkplaceType) {
    setWorkplaceTypes((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function toggleCity(city: string) {
    setSelectedCities((prev) => (prev.includes(city) ? prev.filter((v) => v !== city) : [...prev, city]));
  }

  function toggleDistrict(key: string) {
    setSelectedDistrictKeys((prev) => (prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]));
  }

  return (
    <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
      <AdSlot />

      <div className="w-full max-w-7xl">
        <div className="flex flex-col gap-6 sm:flex-row">
          <aside className="flex shrink-0 flex-col gap-6 sm:w-56">
            <MultiFilterPillGroup
              heading="Workplace"
              options={WORKPLACE_TYPES}
              selected={workplaceTypes}
              onToggle={toggleWorkplaceType}
              onClearAll={() => setWorkplaceTypes([])}
              direction="column"
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rating</h3>
                <button
                  type="button"
                  onClick={() => setMinRating(0)}
                  className={`text-xs font-medium ${
                    minRating === 0 ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:underline"
                  }`}
                >
                  All
                </button>
              </div>
              {/* No slider track/thumb — click a star to jump straight to
                  that rating, or scroll anywhere in the box to fine-tune in
                  0.1 steps. Avoids native <input type="range"> entirely,
                  which never fully themes across browsers (the unfilled
                  track stays a hardcoded light gray even in dark mode). */}
              <div
                onWheel={(e) => {
                  e.preventDefault();
                  setMinRating((prev) => {
                    const next = prev + (e.deltaY < 0 ? 0.1 : -0.1);
                    return Math.min(5, Math.max(0, Math.round(next * 10) / 10));
                  });
                }}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 select-none"
                title="Click a star, or scroll to fine-tune"
              >
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMinRating(n)}
                      className={`text-3xl leading-none transition ${
                        n <= Math.round(minRating) ? "text-amber-500" : "text-muted-foreground/30 hover:text-amber-500/50"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <span className="text-sm font-semibold text-muted-foreground">
                  {minRating === 0 ? "Any" : `${minRating.toFixed(1)}+`}
                </span>
              </div>
            </div>

            <CityDistrictPicker
              selectedCities={selectedCities}
              selectedDistrictKeys={selectedDistrictKeys}
              onToggleCity={toggleCity}
              onToggleDistrict={toggleDistrict}
              onClearAll={() => {
                setSelectedCities([]);
                setSelectedDistrictKeys([]);
              }}
            />
          </aside>

          {/* Results */}
          <div className="flex-1">
            <input
              type="search"
              placeholder="Search a workplace by name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mb-4 w-full rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground"
            />

            {geo === null && <p className="mb-3 text-xs text-muted-foreground">Finding workplaces near you...</p>}
            {geo && geo !== "denied" && (
              <p className="mb-3 text-xs text-muted-foreground">Showing workplaces nearest to you first.</p>
            )}

            {visibleCompanies === null && <p className="text-sm text-muted-foreground">Loading...</p>}
            {visibleCompanies !== null && visibleCompanies.length === 0 && (
              <p className="text-sm text-muted-foreground">No workplaces match these filters yet.</p>
            )}
            <div className="grid grid-cols-1 gap-4 compact:gap-2.5 sm:grid-cols-2 lg:grid-cols-3 compact:lg:grid-cols-4">
              {visibleCompanies?.map((c) => (
                <CompanyCard key={c.id} company={c} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <AdSlot />
    </div>
  );
}
