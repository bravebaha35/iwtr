"use client";

import { useMemo, useState } from "react";
import { TURKEY_PROVINCES } from "@/lib/turkeyGeo";
import { COUNTRIES } from "@/lib/countries";
import { SingleSelectDropdown } from "@/components/Dropdown";

// Real vector flag icons (flag-icons package, imported globally in
// layout.tsx) rather than Unicode flag emoji — Windows renders unsupported
// flag-emoji sequences as their boxed two-letter fallback (e.g. "TR"), so
// emoji alone can't be relied on across platforms.
const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({
  value: c.name,
  label: c.name,
  icon: <span className={`fi fi-${c.code.toLowerCase()} shrink-0 rounded-[2px]`} aria-hidden />,
}));
const DEFAULT_COUNTRY = "Turkey";

// District selection keys are `${provinceName}::${districtName}` — district
// names repeat across provinces (nearly every province has a "Merkez"), so a
// bare district name alone would be ambiguous.
export function districtKey(province: string, district: string): string {
  return `${province}::${district}`;
}

/**
 * Searchable, expandable city/district picker for the left filter sidebar —
 * all 81 Turkish provinces and their districts (see lib/turkeyGeo.ts).
 * Kept deliberately plain (a scrollable list, not a custom slider/carousel
 * widget) — 81 provinces and ~970 districts don't compress into anything
 * fancier without hurting usability, so search + scroll is the whole design.
 * Multi-select: picking a province selects every workplace in it; picking a
 * specific district narrows to just that district.
 */
export function CityDistrictPicker({
  selectedCities,
  selectedDistrictKeys,
  onToggleCity,
  onToggleDistrict,
  onClearAll,
  onNearMe,
  nearMeLoading,
  nearMeActive,
}: {
  selectedCities: string[];
  selectedDistrictKeys: string[];
  onToggleCity: (province: string) => void;
  onToggleDistrict: (key: string) => void;
  onClearAll: () => void;
  // "Near Me" only ever reorders results by proximity (see WorkplaceBrowser)
  // — it deliberately never touches selectedCities/selectedDistrictKeys, so
  // "All" here always means every city, never a silently-narrowed one.
  onNearMe: () => void;
  nearMeLoading: boolean;
  nearMeActive: boolean;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Only Turkey has real city/district data (see lib/countries.ts) — starts
  // on Turkey since it's the only country that actually works today, not
  // because the dropdown itself defaults open (it doesn't; see
  // SingleSelectDropdown). Picking anything else just shows an empty state
  // below until real data for that country exists.
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);
  const isTurkey = country === DEFAULT_COUNTRY;

  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  // Searching "Buca" must surface only İzmir's Buca and Burdur's Bucak — not
  // every other district those two provinces happen to have. So each
  // matching province carries its own `matchingDistricts`: every district
  // when the search is empty or matches the PROVINCE name itself (browsing
  // that whole province), otherwise only the districts that individually
  // match the query.
  const filtered = useMemo(() => {
    if (!isTurkey) return [];
    if (!normalizedQuery) {
      return TURKEY_PROVINCES.map((p) => ({ province: p, matchingDistricts: p.districts }));
    }
    return TURKEY_PROVINCES.flatMap((p) => {
      const provinceNameMatches = p.name.toLocaleLowerCase("tr-TR").includes(normalizedQuery);
      const matchingDistricts = provinceNameMatches
        ? p.districts
        : p.districts.filter((d) => d.toLocaleLowerCase("tr-TR").includes(normalizedQuery));
      if (!provinceNameMatches && matchingDistricts.length === 0) return [];
      return [{ province: p, matchingDistricts }];
    });
  }, [normalizedQuery, isTurkey]);

  const nothingSelected = selectedCities.length === 0 && selectedDistrictKeys.length === 0;

  function toggleExpanded(province: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(province)) next.delete(province);
      else next.add(province);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cities &amp; districts</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNearMe}
            disabled={nearMeLoading}
            title="Sort results by distance from you — doesn't change which cities are selected"
            className={`text-xs font-medium disabled:opacity-50 ${
              nearMeActive ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:underline"
            }`}
          >
            {nearMeLoading ? "Locating…" : "Near Me"}
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className={`text-xs font-medium ${
              nothingSelected ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:underline"
            }`}
          >
            All
          </button>
        </div>
      </div>
      <div className="mb-2">
        <SingleSelectDropdown
          value={country}
          options={COUNTRY_OPTIONS}
          placeholder="Select country"
          onChange={(next) => setCountry(next ?? DEFAULT_COUNTRY)}
        />
      </div>
      <input
        type="search"
        placeholder={isTurkey ? "Search city or district..." : `Search ${country} city or district...`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-2 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground"
      />
      {!isTurkey && (
        <p className="mb-2 rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
          City/district data for {country} isn&apos;t available yet — Turkey is the only country covered so far.
        </p>
      )}
      <div className="no-scrollbar max-h-72 overflow-y-auto rounded-lg border border-border p-1.5 text-sm">
        {filtered.map(({ province: p, matchingDistricts }) => {
          const isExpanded = expanded.has(p.name) || normalizedQuery !== "";
          const cityActive = selectedCities.includes(p.name);
          return (
            <div key={p.plate} className="mb-0.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleExpanded(p.name)}
                  aria-label={isExpanded ? `Collapse ${p.name}` : `Expand ${p.name}`}
                  className="w-4 shrink-0 text-[10px] text-muted-foreground"
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleCity(p.name)}
                  className={`flex-1 truncate rounded px-1.5 py-0.5 text-left text-xs font-medium transition ${
                    cityActive ? "bg-brand-600 text-white" : "text-foreground hover:bg-surface-muted"
                  }`}
                >
                  {p.name}
                </button>
              </div>
              {isExpanded && (
                <div className="ml-5 mt-0.5 flex flex-wrap gap-1">
                  {matchingDistricts.map((d) => {
                    const key = districtKey(p.name, d);
                    const active = selectedDistrictKeys.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onToggleDistrict(key)}
                        className={`rounded-full px-2 py-0.5 text-[11px] transition ${
                          active
                            ? "bg-brand-600 text-white"
                            : "border border-border text-muted-foreground hover:bg-surface-muted"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
