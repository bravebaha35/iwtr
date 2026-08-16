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
  allSelected,
  onAllClick,
  onNearMe,
  nearMeLoading,
  nearMeActive,
}: {
  selectedCities: string[];
  selectedDistrictKeys: string[];
  onToggleCity: (province: string) => void;
  onToggleDistrict: (key: string) => void;
  // Driven by the parent, not derived from selectedCities/selectedDistrictKeys
  // being empty: those stay empty both when nothing is picked AND when "All"
  // is active (some real companies have no city set at all — e.g. fully
  // remote ones — so actually listing every province in the query would
  // wrongly exclude them; "no location filter" is what really means "every
  // company", so the all-state is tracked separately and never sent as a
  // literal list of every city).
  allSelected: boolean;
  onAllClick: () => void;
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
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</h3>
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
            onClick={onAllClick}
            className={`text-xs font-medium ${
              allSelected ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:underline"
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
      <div className="rounded-lg border border-border p-1.5">
        <input
          type="search"
          placeholder={isTurkey ? "Search city or district..." : `Search ${country} city or district...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-1.5 w-full rounded-md border border-border bg-surface-muted px-2 py-1 text-xs text-foreground"
        />
        {!isTurkey && (
          <p className="mb-1.5 rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
            City/district data for {country} isn&apos;t available yet — Turkey is the only country covered so far.
          </p>
        )}
        <div className="no-scrollbar max-h-64 overflow-y-auto text-sm">
        {filtered.map(({ province: p, matchingDistricts }) => {
          const isExpanded = expanded.has(p.name) || normalizedQuery !== "";
          const wholeCitySelected = selectedCities.includes(p.name);
          // Lit up when the province itself is selected OR when any one of
          // its districts is — picking a district shows its parent city as
          // "chosen" too, purely as a visual breadcrumb. It does NOT add the
          // city to selectedCities, so the actual filter stays scoped to
          // just that district; clicking the city's own name (below) is the
          // only thing that broadens the filter to the whole city.
          const hasSelectedDistrict = p.districts.some((d) => selectedDistrictKeys.includes(districtKey(p.name, d)));
          const cityActive = allSelected || wholeCitySelected || hasSelectedDistrict;
          // A plain toggleCity() only flips the coarse selectedCities flag —
          // fine when nothing's selected yet (turns the whole city on), but
          // once a district has been carved out (city flag already dropped,
          // its other districts held individually — see the district
          // handler below), clicking the city name would just add the city
          // flag back on top of those leftover district keys and silently
          // re-expand back to the full city instead of clearing it. So:
          // clicking an active city (however it got that way — whole-city
          // flag, one district, or "all but one") always clears everything
          // for it; clicking an inactive one selects the whole city.
          function handleCityClick() {
            if (allSelected) {
              // "All" is active (not a real per-city selection to unwind) —
              // clicking a specific city narrows down to just that one,
              // same as clicking it from a genuinely empty selection.
              onToggleCity(p.name);
            } else if (cityActive) {
              if (wholeCitySelected) onToggleCity(p.name);
              p.districts.forEach((d) => {
                const k = districtKey(p.name, d);
                if (selectedDistrictKeys.includes(k)) onToggleDistrict(k);
              });
            } else {
              onToggleCity(p.name);
            }
          }
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
                  onClick={handleCityClick}
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
                    // Selecting the whole city lights up every one of its
                    // districts too (the API already matches every district
                    // when the parent city is selected — see
                    // companies.service.ts) — and since this is derived from
                    // selectedCities rather than stored per-district,
                    // deselecting the city un-lights them all again with no
                    // extra bookkeeping.
                    const active = allSelected || selectedDistrictKeys.includes(key) || wholeCitySelected;
                    // Clicking a district that's only lit because the whole
                    // city is selected (or because "All" is active) carves it
                    // out: drop the coarse city flag and individually
                    // re-select every OTHER district, so the net effect is
                    // "this city, minus the one just clicked" rather than an
                    // all-or-nothing city toggle. Once the city is no longer
                    // selected wholesale, this is just the normal
                    // single-district toggle.
                    function handleClick() {
                      if (allSelected) {
                        onToggleDistrict(key);
                      } else if (wholeCitySelected) {
                        onToggleCity(p.name);
                        p.districts
                          .filter((other) => other !== d)
                          .forEach((other) => onToggleDistrict(districtKey(p.name, other)));
                      } else {
                        onToggleDistrict(key);
                      }
                    }
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={handleClick}
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
    </div>
  );
}
