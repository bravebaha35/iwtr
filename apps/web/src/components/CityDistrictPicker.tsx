"use client";

import { useState } from "react";
import { TURKEY_PROVINCES } from "@/lib/turkeyGeo";
import { COUNTRIES } from "@/lib/countries";
import { SingleSelectDropdown } from "@/components/Dropdown";
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

// Real vector flags (flag-icons, loaded in layout.tsx): Windows shows flag
// emoji as two letters.
const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({
  value: c.name,
  label: c.name,
  icon: <span className={`fi fi-${c.code.toLowerCase()} shrink-0 rounded-[2px]`} aria-hidden />,
}));
const DEFAULT_COUNTRY = "Turkey";
const CITY_OPTIONS = TURKEY_PROVINCES.map((p) => ({ value: p.name, label: p.name }));

/**
 * The filter sidebar's Location: a country, then one city, then, if wanted,
 * some of that city's districts (a full tick list, no inner scrolling).
 * Picking a city shows every workplace in it; ticking districts narrows to
 * just those; "All" goes back to the whole city. Only Turkey has city data
 * so far.
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
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);
  const isTurkey = country === DEFAULT_COUNTRY;

  const city = selectedCities[0] ?? selectedDistrictKeys[0]?.split("::")[0] ?? null;
  const province = city ? TURKEY_PROVINCES.find((p) => p.name === city) ?? null : null;
  const chosen = new Set(
    selectedDistrictKeys.filter((k) => k.startsWith(`${city}::`)).map((k) => k.split("::")[1]),
  );

  function pickCity(next: string | null) {
    if (!next) onReset();
    else onChange({ cities: [next], districtKeys: [] });
  }

  function toggleDistrict(d: string) {
    if (!city) return;
    const next = new Set(chosen);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    // No district left ticked: back to the whole city.
    onChange(
      next.size === 0
        ? { cities: [city], districtKeys: [] }
        : { cities: [], districtKeys: [...next].map((name) => districtKey(city, name)) },
    );
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
        <div className="flex flex-col gap-1.5">
          <SingleSelectDropdown
            value={country}
            options={COUNTRY_OPTIONS}
            placeholder="Select country"
            ariaLabel="Country"
            clearable={false}
            onChange={(next) => {
              setCountry(next ?? DEFAULT_COUNTRY);
              if (city) onReset();
            }}
          />
          {isTurkey ? (
            <SingleSelectDropdown
              value={city}
              options={CITY_OPTIONS}
              placeholder="Choose a city"
              ariaLabel="City"
              searchable
              onChange={pickCity}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
              {t("City/district data for {country} isn't available yet - Turkey is the only country covered so far.", {
                country: t(country),
              })}
            </p>
          )}
        </div>

        {province && (
          <div className="mt-2.5 border-t border-border/70 pt-2">
            <div className="mb-1 flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold text-muted-foreground">{t("Districts")}</p>
              {/* Lit while the whole city is chosen; pressing it clears the
                  ticked districts again. */}
              <button
                type="button"
                onClick={() => onChange({ cities: [province.name], districtKeys: [] })}
                aria-pressed={chosen.size === 0}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                  chosen.size === 0 ? "bg-brand-600 text-white" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                {chosen.size === 0 ? t("All") : t("All ({n} chosen)", { n: chosen.size })}
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {province.districts.map((d) => {
                const on = chosen.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleDistrict(d)}
                    className={`group flex min-h-8 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] leading-tight transition active:scale-[0.99] ${
                      on ? "bg-brand-600 font-semibold text-white" : "text-foreground/80 hover:bg-surface-muted hover:text-foreground"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] transition ${
                        on ? "bg-white/25" : "bg-surface-muted ring-1 ring-inset ring-border group-hover:ring-foreground/40"
                      }`}
                    >
                      {on && (
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">{d}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
