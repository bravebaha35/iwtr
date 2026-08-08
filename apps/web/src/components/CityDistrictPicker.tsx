"use client";

import { useMemo, useState } from "react";
import { TURKEY_PROVINCES } from "@/lib/turkeyGeo";

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

  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const filtered = useMemo(() => {
    if (!normalizedQuery) return TURKEY_PROVINCES;
    return TURKEY_PROVINCES.filter(
      (p) =>
        p.name.toLocaleLowerCase("tr-TR").includes(normalizedQuery) ||
        p.districts.some((d) => d.toLocaleLowerCase("tr-TR").includes(normalizedQuery)),
    );
  }, [normalizedQuery]);

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
      <input
        type="search"
        placeholder="Search city or district..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-2 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground"
      />
      <div className="no-scrollbar max-h-72 overflow-y-auto rounded-lg border border-border p-1.5 text-sm">
        {filtered.map((p) => {
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
                  {p.districts.map((d) => {
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
