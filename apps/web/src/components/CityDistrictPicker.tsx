"use client";

import { useEffect, useState } from "react";
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
 * some of that city's districts (a dropdown of side-by-side chips).
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
  const [districtsOpen, setDistrictsOpen] = useState(false);

  // Escape closes the districts panel, like a click anywhere else does.
  useEffect(() => {
    if (!districtsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDistrictsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [districtsOpen]);
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
          <div className="relative mt-1.5">
            {/* Districts: a dropdown like the two above. Open, the city's
                districts sit side by side as tick chips; it stays open while
                ticking and closes on a click anywhere else. */}
            <button
              type="button"
              onClick={() => setDistrictsOpen((o) => !o)}
              aria-haspopup="dialog"
              aria-expanded={districtsOpen}
              aria-label={t("Districts")}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left text-xs font-medium text-foreground hover:bg-surface-muted"
            >
              <span className={`min-w-0 truncate ${chosen.size > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                {chosen.size === 0
                  ? t("Districts")
                  : chosen.size <= 2
                    ? [...chosen].join(", ")
                    : t("{n} districts", { n: chosen.size })}
              </span>
              <span className={`shrink-0 text-[10px] text-muted-foreground transition-transform ${districtsOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {districtsOpen && (
              <>
                <div className="fixed inset-0 z-[65]" onClick={() => setDistrictsOpen(false)} />
                <div
                  role="dialog"
                  aria-label={t("Districts")}
                  className="absolute left-0 z-[70] mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-2.5 shadow-lg"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {t("{city} districts", { city: province.name })}
                    </p>
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
                  <div className="no-scrollbar flex max-h-80 flex-wrap gap-1.5 overflow-y-auto">
                    {province.districts.map((d) => {
                      const on = chosen.has(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => toggleDistrict(d)}
                          className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium transition active:scale-[0.97] ${
                            on ? "bg-brand-600 text-white" : "bg-surface-muted text-foreground/80 hover:text-foreground"
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
