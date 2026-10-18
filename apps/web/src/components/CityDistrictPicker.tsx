"use client";

import { useId, useMemo, useRef, useState } from "react";
import { TURKEY_PROVINCES } from "@/lib/turkeyGeo";
import { RewindButton } from "@/components/RewindButton";
import { useT } from "@/lib/i18n/client";

// District selection keys are `${provinceName}::${districtName}` — district
// names repeat across provinces (nearly every province has a "Merkez"), so a
// bare district name alone would be ambiguous.
export function districtKey(province: string, district: string): string {
  return `${province}::${district}`;
}

export interface LocationSelection {
  cities: string[];
  districtKeys: string[];
}

// Case and accent blind, Turkish-aware: "izmir" finds "İzmir", "cankaya" finds "Çankaya".
function fold(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

type Match = { province: string; district: string | null };

const INDEX = TURKEY_PROVINCES.map((p) => ({
  name: p.name,
  key: fold(p.name),
  districts: p.districts.map((d) => ({ name: d, key: fold(d) })),
}));

// Provinces whose name matches come first, then single districts ("Buca,
// İzmir"), so a district can be reached in one step from the box.
function search(query: string): Match[] {
  const q = fold(query.trim());
  if (!q) return INDEX.map((p) => ({ province: p.name, district: null }));
  const provinces = INDEX.filter((p) => p.key.includes(q))
    .sort((a, b) => Number(!a.key.startsWith(q)) - Number(!b.key.startsWith(q)))
    .map((p) => ({ province: p.name, district: null }));
  const districts: Match[] = [];
  for (const p of INDEX) {
    for (const d of p.districts) {
      if (d.key.startsWith(q)) districts.push({ province: p.name, district: d.name });
    }
  }
  return [...provinces, ...districts.slice(0, 30)];
}

const CHIP = "rounded-full px-2.5 py-1 text-[11px] font-medium transition";
const CHIP_ON = "bg-brand-600 text-white";
const CHIP_OFF = "bg-surface-muted text-muted-foreground hover:text-foreground";

/**
 * The filter sidebar's Location: one city at a time (Turkey's 81 provinces),
 * then, if wanted, some of that city's districts. Picking a city shows every
 * workplace in it; ticking districts narrows to just those. A different city
 * replaces the first one, districts and all.
 */
export function CityDistrictPicker({
  selectedCities,
  selectedDistrictKeys,
  onChange,
  onReset,
  onNearMe,
  nearMeLoading,
  nearMeActive,
}: {
  selectedCities: string[];
  selectedDistrictKeys: string[];
  onChange: (next: LocationSelection) => void;
  // Clears the city and its districts: every workplace shows again
  // (including fully remote ones with no city set at all).
  onReset: () => void;
  // "Near Me" only reorders results by distance; it never picks a city.
  onNearMe: () => void;
  nearMeLoading: boolean;
  nearMeActive: boolean;
}) {
  const t = useT();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [districtQuery, setDistrictQuery] = useState("");
  const blurTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const city = selectedCities[0] ?? selectedDistrictKeys[0]?.split("::")[0] ?? null;
  const province = city ? TURKEY_PROVINCES.find((p) => p.name === city) ?? null : null;
  const chosenDistricts = new Set(
    selectedDistrictKeys.filter((k) => k.startsWith(`${city}::`)).map((k) => k.split("::")[1]),
  );
  const results = useMemo(() => search(query), [query]);
  const visibleDistricts = useMemo(() => {
    if (!province) return [];
    const q = fold(districtQuery.trim());
    return q ? province.districts.filter((d) => fold(d).includes(q)) : province.districts;
  }, [province, districtQuery]);

  function pick(match: Match) {
    setQuery("");
    setOpen(false);
    setDistrictQuery("");
    onChange(
      match.district
        ? { cities: [], districtKeys: [districtKey(match.province, match.district)] }
        : { cities: [match.province], districtKeys: [] },
    );
  }

  function toggleDistrict(d: string) {
    if (!city) return;
    const next = new Set(chosenDistricts);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    // No district left ticked: back to the whole city.
    onChange(
      next.size === 0
        ? { cities: [city], districtKeys: [] }
        : { cities: [], districtKeys: [...next].map((name) => districtKey(city, name)) },
    );
  }

  function clearCity() {
    onReset();
    setDistrictQuery("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-foreground">{t("Location")}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNearMe}
            disabled={nearMeLoading}
            title={t("Sort results by distance from you - doesn't change which cities are selected")}
            className={`text-xs font-medium disabled:opacity-50 ${
              nearMeActive ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:underline"
            }`}
          >
            {nearMeLoading ? t("Locating...") : t("Near Me")}
          </button>
          <RewindButton onClick={onReset} active={city !== null} title="Clear location filter" />
        </div>
      </div>

      <div className="rounded-2xl bg-surface p-2 shadow-xs">
        {province ? (
          <>
            {/* The chosen city, with a way back to choosing another. */}
            <div className="flex items-center gap-2 rounded-xl bg-surface-muted/70 py-1.5 pl-2.5 pr-1.5">
              <span className="fi fi-tr shrink-0 rounded-[2px]" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{province.name}</span>
              <button
                type="button"
                onClick={clearCity}
                aria-label={t("Choose another city")}
                title={t("Choose another city")}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="mt-2.5 flex items-baseline justify-between px-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground">{t("Districts")}</p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {chosenDistricts.size > 0 ? t("{n} chosen", { n: chosenDistricts.size }) : t("All")}
              </p>
            </div>
            {province.districts.length > 12 && (
              <input
                type="search"
                value={districtQuery}
                onChange={(e) => setDistrictQuery(e.target.value)}
                placeholder={t("Search {city} districts...", { city: province.name })}
                aria-label={t("Search {city} districts...", { city: province.name })}
                className="mt-1.5 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
              />
            )}
            <div className="no-scrollbar mt-2 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              {!districtQuery && (
                <button
                  type="button"
                  onClick={() => onChange({ cities: [province.name], districtKeys: [] })}
                  aria-pressed={chosenDistricts.size === 0}
                  className={`${CHIP} ${chosenDistricts.size === 0 ? CHIP_ON : CHIP_OFF}`}
                >
                  {t("All of {city}", { city: province.name })}
                </button>
              )}
              {visibleDistricts.map((d) => {
                const on = chosenDistricts.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDistrict(d)}
                    aria-pressed={on}
                    className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
                  >
                    {d}
                  </button>
                );
              })}
              {visibleDistricts.length === 0 && (
                <p className="px-1 py-1 text-xs text-muted-foreground">{t("No district by that name.")}</p>
              )}
            </div>
          </>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 focus-within:border-brand-600 dark:focus-within:border-brand-400">
              <span className="fi fi-tr shrink-0 rounded-[2px]" aria-hidden />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-label={t("Choose a city")}
                value={query}
                placeholder={t("Choose a city")}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  setHighlight(0);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                  blurTimer.current = window.setTimeout(() => setOpen(false), 120);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setOpen(true);
                    setHighlight((h) => Math.min(h + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Enter" && open && results[highlight]) {
                    e.preventDefault();
                    pick(results[highlight]);
                  } else if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoComplete="off"
              />
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
            {open && (
              <ul
                id={listId}
                role="listbox"
                aria-label={t("Cities")}
                className="no-scrollbar absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl bg-surface p-1 shadow-lg ring-1 ring-border"
                onMouseDown={(e) => {
                  // Keep focus in the box while a row is clicked.
                  e.preventDefault();
                  if (blurTimer.current) window.clearTimeout(blurTimer.current);
                }}
              >
                {results.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">{t("No city or district by that name.")}</li>}
                {results.map((m, i) => (
                  <li
                    key={`${m.province}::${m.district ?? ""}`}
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(m)}
                    className={`flex cursor-pointer items-baseline justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
                      i === highlight ? "bg-surface-muted" : ""
                    }`}
                  >
                    <span className="truncate text-foreground">{m.district ?? m.province}</span>
                    {m.district && <span className="shrink-0 text-[11px] text-muted-foreground">{m.province}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
